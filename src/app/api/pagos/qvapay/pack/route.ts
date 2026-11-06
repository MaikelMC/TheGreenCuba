import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { accesoNegocio } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { siteConfig } from "@/config/site";
import { db } from "@/lib/db";
import { packsMedida, pagos, places } from "@/lib/db/schema";
import { DEV_PLACE_ID } from "@/lib/dev-place";
import { crearFactura, qvapayConfigurado } from "@/lib/qvapay";
import { rateLimit } from "@/lib/rate-limit";
import { generateId } from "@/lib/utils";

/**
 * Abre una factura de QvaPay para un pack a medida.
 *
 * El precio no llega del navegador: se lee del pack en la base.
 * El pack debe estar en estado `enviado`; cualquier otro estado devuelve 409.
 * Solo el dueño puede pagar.
 *
 * Body: { placeId: string; packId: string }
 */

const LIMITE = 10;
const VENTANA_MS = 60_000;

export async function POST(req: NextRequest) {
  const limitado = rateLimit(req, LIMITE, VENTANA_MS);
  if (!limitado.ok) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento." },
      { status: 429 },
    );
  }

  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  let body: { placeId?: unknown; packId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
  const packId = typeof body.packId === "string" ? body.packId.trim() : "";

  if (!placeId || !packId) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const acceso = await accesoNegocio(user, placeId);
  if (!acceso?.esDueno) {
    return NextResponse.json({ error: "Solo el dueño puede pagar el pack." }, { status: 403 });
  }

  if (placeId === DEV_PLACE_ID) {
    return NextResponse.json(
      { error: "El negocio de prueba no paga packs." },
      { status: 409 },
    );
  }

  if (!qvapayConfigurado()) {
    return NextResponse.json(
      { error: "QvaPay no está configurado todavía." },
      { status: 503 },
    );
  }

  const [pack] = await db
    .select({
      id: packsMedida.id,
      negocioId: packsMedida.negocioId,
      estado: packsMedida.estado,
      precioUsd: packsMedida.precioUsd,
      oferta2x1: packsMedida.oferta2x1,
    })
    .from(packsMedida)
    .where(eq(packsMedida.id, packId))
    .limit(1);

  if (!pack || pack.negocioId !== placeId) {
    return NextResponse.json({ error: "Pack no encontrado." }, { status: 404 });
  }

  if (pack.estado !== "enviado") {
    return NextResponse.json(
      { error: "El pack no está listo para pagar." },
      { status: 409 },
    );
  }

  if (!pack.precioUsd || pack.precioUsd <= 0) {
    return NextResponse.json(
      { error: "El pack no tiene precio fijado." },
      { status: 409 },
    );
  }

  const [place] = await db
    .select({ name: places.name })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);

  if (!place) return NextResponse.json({ error: "El negocio no existe." }, { status: 404 });

  const usd = pack.precioUsd;
  const montoCentavos = Math.round(usd * 100);
  const descripcion = `Pack a medida — ${place.name}`.slice(0, 300);

  const id = generateId();

  await db.insert(pagos).values({
    id,
    negocioId: placeId,
    tipo: "pack_medida",
    clave: packId,
    packMedidaId: packId,
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
    console.error("[qvapay/pack] no se pudo crear la factura", error);
    return NextResponse.json(
      { error: "QvaPay no pudo generar la factura. Inténtalo de nuevo." },
      { status: 502 },
    );
  }
}
