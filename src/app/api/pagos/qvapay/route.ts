import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { siteConfig } from "@/config/site";
import { db } from "@/lib/db";
import { pagos, places } from "@/lib/db/schema";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import {
  MODULOS,
  PACKS_ORDER,
  nombreDe,
  type ClaveModulo,
  type Pack,
} from "@/lib/plans";
import { crearFactura, qvapayConfigurado } from "@/lib/qvapay";
import { rateLimit } from "@/lib/rate-limit";
import { generateId } from "@/lib/utils";

/**
 * Abre una factura de QvaPay para contratar un pack o un módulo.
 *
 * El precio **no llega del navegador**: se resuelve aquí con el catálogo vivo y
 * se guarda en centavos. Lo único que manda el cliente es qué quiere. Si el
 * importe viniera del cliente, cualquiera podría pagar 0,01 por el plan Pro y
 * el webhook lo aplicaría.
 *
 * La fila de `pagos` se crea antes que la factura porque su `id` es el
 * `remote_id` que QvaPay devuelve en el webhook. Es el hilo que une el cobro con
 * lo contratado; no se confía en ningún otro dato de vuelta.
 *
 * Requiere sesión de dueño del negocio (`canManagePlace`). El negocio de prueba
 * no paga: cambia de plan a voluntad desde el panel.
 */

const LIMITE = 10;
const VENTANA_MS = 60_000;

const PACKS = new Set<string>(PACKS_ORDER);
const MODULO_CLAVES = new Set<string>(Object.keys(MODULOS));

type Tipo = "plan" | "modulo";

export async function POST(req: NextRequest) {
  const limitado = rateLimit(req, LIMITE, VENTANA_MS);
  if (!limitado.ok) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento." },
      { status: 429 },
    );
  }

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const body = (cuerpo ?? {}) as Record<string, unknown>;
  const placeId =
    typeof body.placeId === "string" ? body.placeId.trim().slice(0, 64) : "";
  const tipo = body.tipo;
  const clave = typeof body.clave === "string" ? body.clave.trim() : "";

  if (!placeId || (tipo !== "plan" && tipo !== "modulo") || !clave) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const esPlan = tipo === "plan";
  if (esPlan ? !PACKS.has(clave) : !MODULO_CLAVES.has(clave)) {
    return NextResponse.json({ error: "Ese plan no existe." }, { status: 400 });
  }

  if (!(await canManagePlace(req, placeId))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (placeId === DEV_PLACE_ID) {
    return NextResponse.json(
      { error: "El negocio de prueba no paga planes." },
      { status: 409 },
    );
  }

  if (!qvapayConfigurado()) {
    return NextResponse.json(
      { error: "QvaPay no está configurado todavía." },
      { status: 503 },
    );
  }

  const [place] = await db
    .select({ name: places.name })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);

  if (!place) {
    return NextResponse.json({ error: "El negocio no existe." }, { status: 404 });
  }

  const cat = await cargarCatalogo();
  const usd = esPlan
    ? cat.packs[clave as Pack].usd
    : cat.modulos[clave as ClaveModulo].usd;
  const montoCentavos = Math.round(usd * 100);

  if (!Number.isFinite(usd) || montoCentavos < 1) {
    return NextResponse.json(
      { error: "Ese plan no tiene un precio válido." },
      { status: 409 },
    );
  }

  const nombre = esPlan
    ? nombreDe(clave as Pack, cat)
    : cat.modulos[clave as ClaveModulo].nombre;
  const descripcion = `${esPlan ? "Plan" : "Módulo"} ${nombre} — ${place.name}`.slice(
    0,
    300,
  );

  const id = generateId();

  /* La fila nace pendiente. Si QvaPay rechaza la factura, queda en `fallido` y
     no hay derecho que aplicar: el webhook solo mira las pendientes. */
  await db.insert(pagos).values({
    id,
    negocioId: placeId,
    tipo: tipo as Tipo,
    clave,
    montoCentavos,
  });

  try {
    const factura = await crearFactura({
      monto: usd,
      descripcion,
      remoteId: id,
      webhook: `${siteConfig.url.replace(/\/+$/, "")}/api/pagos/qvapay/webhook`,
    });

    await db
      .update(pagos)
      .set({ qvapayId: factura.transactionUuid })
      .where(eq(pagos.id, id));

    return NextResponse.json({ url: factura.url });
  } catch (error) {
    await db
      .update(pagos)
      .set({ estado: "fallido" })
      .where(eq(pagos.id, id));
    console.error("[qvapay] no se pudo crear la factura", error);

    return NextResponse.json(
      { error: "QvaPay no pudo generar la factura. Inténtalo de nuevo." },
      { status: 502 },
    );
  }
}
