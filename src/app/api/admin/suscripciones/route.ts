import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { suscripciones } from "@/lib/db/schema";
import {
  MODULOS,
  aSuscripcion,
  planEfectivo,
  PLAN_ORDER,
  type ClaveModulo,
  type Plan,
} from "@/lib/plans";
import { generateId } from "@/lib/utils";

/**
 * El plan de un negocio, para administración.
 *
 * Es la única puerta que escribe `suscripciones` a mano: aquí solo se apunta el
 * plan y sus fechas, y el plan efectivo lo deduce `planEfectivo` de ellas.
 *
 * Cuando la prueba vence o el pago se pasa de fecha, el plan cae a gratis solo.
 * **No se borra nada**: lo que el negocio escribió sigue ahí, y vuelve a
 * aparecer si se le vuelve a subir de plan.
 *
 * `isAdminRequest` acepta la sesión de administrador o la cabecera
 * `x-admin-key`, igual que el resto de rutas de administración.
 */

const PLAN_IDS = new Set<string>(PLAN_ORDER);
const ESTADOS = new Set(["activa", "cancelada"]);

function leer(body: Record<string, unknown>) {
  const plan =
    typeof body.plan === "string" && PLAN_IDS.has(body.plan)
      ? (body.plan as Plan)
      : undefined;

  const estado =
    typeof body.estado === "string" && ESTADOS.has(body.estado)
      ? (body.estado as "activa" | "cancelada")
      : undefined;

  /* Una fecha vacía desde el formulario significa «quítala», y por eso `null` se
     acepta explícitamente en vez de tratarse como ausente: sin esto, borrar el
     vencimiento de un negocio no había forma de hacerlo. */
  const fecha = (value: unknown): Date | null | undefined => {
    if (value === null || value === "") return null;
    if (typeof value !== "string") return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };

  const descuentoPct = (() => {
    if (body.descuentoPct === null || body.descuentoPct === "") return null;
    const value = Number(body.descuentoPct);
    if (!Number.isInteger(value) || value < 0 || value > 100) return undefined;
    return value;
  })();

  /* Los módulos sueltos llegan como lista de claves. Se desconocen las que ya
     no existen en el catálogo, para que una clave retirada no llegue al `jsonb`
     y rompa la lectura de permisos del negocio. */
  const modulos = (() => {
    if (!Array.isArray(body.modulos)) return undefined;
    const claves = new Set<string>(Object.keys(MODULOS));
    return [...new Set(body.modulos)].filter(
      (clave): clave is ClaveModulo =>
        typeof clave === "string" && claves.has(clave),
    );
  })();

  return {
    plan,
    estado,
    trialHasta: fecha(body.trialHasta),
    venceEn: fecha(body.venceEn),
    descuentoPct,
    modulos,
  };
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const negocioId = new URL(req.url).searchParams.get("negocioId");
  if (!negocioId) {
    return NextResponse.json({ error: "Falta negocioId" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(suscripciones)
    .where(eq(suscripciones.negocioId, negocioId))
    .limit(1);

  /* Sin fila se devuelve el estado por defecto, no un 404: el formulario de
     administración tiene que poder abrirse sobre un negocio que nunca tuvo
     suscripción —las fichas anteriores a esta tabla— y crearle una al guardar. */
  const suscripcion = row ?? {
    id: null,
    negocioId,
    plan: "gratis" as const,
    estado: "activa" as const,
    trialHasta: null,
    venceEn: null,
    descuentoPct: null,
    modulos: [] as { clave: string; desde: string; hasta: string | null }[],
  };

  return NextResponse.json({
    ...suscripcion,
    planEfectivo: planEfectivo(aSuscripcion(suscripcion)),
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const negocioId = typeof body.negocioId === "string" ? body.negocioId : "";
  if (!negocioId) {
    return NextResponse.json({ error: "Falta negocioId" }, { status: 400 });
  }

  const { plan, estado, trialHasta, venceEn, descuentoPct, modulos } =
    leer(body);

  /* La lista de módulos es la deseada, no un parche: al guardarla se conserva
     el `desde` de los que ya estaban y se marca con la fecha de hoy los nuevos,
     para no reiniciar la antigüedad de un módulo solo por tocar otro campo. */
  let guardados: { clave: ClaveModulo; desde: string; hasta: null }[] | undefined;
  if (modulos !== undefined) {
    const [previa] = await db
      .select({ modulos: suscripciones.modulos })
      .from(suscripciones)
      .where(eq(suscripciones.negocioId, negocioId))
      .limit(1);
    const desde = new Map((previa?.modulos ?? []).map((m) => [m.clave, m.desde]));
    const ahora = new Date().toISOString();
    guardados = modulos.map((clave) => ({
      clave,
      desde: desde.get(clave) ?? ahora,
      hasta: null,
    }));
  }

  /* Solo lo que vino. Un `undefined` aquí es «no lo toques», y volcarlo dejaría
     el campo a nulo en cada guardado parcial. */
  const set = {
    ...(plan !== undefined ? { plan } : {}),
    ...(estado !== undefined ? { estado } : {}),
    ...(trialHasta !== undefined ? { trialHasta } : {}),
    ...(venceEn !== undefined ? { venceEn } : {}),
    ...(descuentoPct !== undefined ? { descuentoPct } : {}),
    ...(guardados !== undefined ? { modulos: guardados } : {}),
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(suscripciones)
    .values({
      id: generateId(),
      negocioId,
      plan: plan ?? "gratis",
      estado: estado ?? "activa",
      trialHasta: trialHasta ?? null,
      venceEn: venceEn ?? null,
      descuentoPct: descuentoPct ?? null,
      modulos: guardados ?? [],
    })
    /* Crear si no existe y actualizar si existe, en un solo viaje. El `where`
       del update no lleva el `negocioId` porque el `insert` ya falló contra el
       `unique` de esa columna: la fila que se actualiza es la suya. */
    .onConflictDoUpdate({
      target: suscripciones.negocioId,
      set,
    })
    .returning();

  return NextResponse.json({
    ...row,
    planEfectivo: planEfectivo(aSuscripcion(row!)),
  });
}
