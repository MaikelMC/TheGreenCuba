import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { suscripciones } from "@/lib/db/schema";
import type { ModuloGuardado } from "@/lib/db/schema/suscripciones";
import {
  MODULOS,
  aSuscripcion,
  planEfectivo,
  PLAN_ORDER,
  type ClaveModulo,
  type Plan,
} from "@/lib/plans";
import { generateId } from "@/lib/utils";
import { invalidarCatalogo } from "@/lib/db/queries";
import { finDelDiaEn } from "@/lib/ficha/horario";

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

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lee el cuerpo. Un campo ausente es «no lo toques»; uno presente y no válido
 * va a `invalidos` y la ruta responde 400. Antes se ignoraba en silencio y el
 * panel celebraba «Plan guardado» sin haber guardado ese campo.
 */
function leer(body: Record<string, unknown>) {
  const invalidos: string[] = [];

  let plan: Plan | undefined;
  if (body.plan !== undefined) {
    if (typeof body.plan === "string" && PLAN_IDS.has(body.plan)) {
      plan = body.plan as Plan;
    } else invalidos.push("plan");
  }

  let estado: "activa" | "cancelada" | undefined;
  if (body.estado !== undefined) {
    if (typeof body.estado === "string" && ESTADOS.has(body.estado)) {
      estado = body.estado as "activa" | "cancelada";
    } else invalidos.push("estado");
  }

  /* Una fecha vacía desde el formulario significa «quítala», y por eso `null` se
     acepta explícitamente en vez de tratarse como ausente: sin esto, borrar el
     vencimiento de un negocio no había forma de hacerlo.

     Llega como `YYYY-MM-DD` del `<input type="date">` y vale **el día entero
     en Cuba**: se guarda su último milisegundo en `America/Havana`. */
  const fecha = (campo: string): Date | null | undefined => {
    const value = body[campo];
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    if (typeof value === "string" && FECHA_RE.test(value)) {
      const date = finDelDiaEn(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    invalidos.push(campo);
    return undefined;
  };

  const descuentoPct = (() => {
    if (body.descuentoPct === undefined) return undefined;
    if (body.descuentoPct === null || body.descuentoPct === "") return null;
    const value = Number(body.descuentoPct);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      invalidos.push("descuentoPct");
      return undefined;
    }
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
    trialHasta: fecha("trialHasta"),
    venceEn: fecha("venceEn"),
    descuentoPct,
    modulos,
    invalidos,
  };
}

const NOMBRE_CAMPO: Record<string, string> = {
  plan: "el plan",
  estado: "el estado",
  trialHasta: "la fecha de la prueba",
  venceEn: "la fecha de pago",
  descuentoPct: "el descuento (entero de 0 a 100)",
};

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

  const { plan, estado, trialHasta, venceEn, descuentoPct, modulos, invalidos } =
    leer(body);

  if (invalidos.length > 0) {
    return NextResponse.json(
      {
        error: `No se guardó nada: revisa ${invalidos.map((c) => NOMBRE_CAMPO[c] ?? c).join(", ")}.`,
      },
      { status: 400 },
    );
  }

  /* El `updatedAt` que vio el editor al cargar. Si la fila cambió desde
     entonces —un pago de QvaPay que renovó, otro administrador—, guardar
     pisaría ese cambio sin que nadie lo viera. La comprobación va dentro del
     propio upsert (`setWhere`), así que no hay carrera entre leer y escribir. */
  const esperado =
    typeof body.esperado === "string" ? new Date(body.esperado) : null;
  if (esperado && Number.isNaN(esperado.getTime())) {
    return NextResponse.json({ error: "Versión del plan no válida." }, { status: 400 });
  }

  /* La lista de módulos es la deseada, no un parche. Un módulo que ya estaba y
     sigue vigente se guarda **tal cual**, con su `hasta`: los que paga QvaPay
     llevan fecha de fin, y reescribirlos con `hasta: null` los regalaba para
     siempre con solo tocar otro campo. Uno nuevo, o uno vencido que se vuelve
     a marcar, entra hoy y sin fin (lo activa administración a mano). */
  let guardados: ModuloGuardado[] | undefined;
  if (modulos !== undefined) {
    const [previa] = await db
      .select({ modulos: suscripciones.modulos })
      .from(suscripciones)
      .where(eq(suscripciones.negocioId, negocioId))
      .limit(1);
    const ahora = new Date();
    const vigentes = new Map(
      (previa?.modulos ?? [])
        .filter((m) => !m.hasta || new Date(m.hasta) > ahora)
        .map((m) => [m.clave, m]),
    );
    guardados = modulos.map(
      (clave) =>
        vigentes.get(clave) ?? { clave, desde: ahora.toISOString(), hasta: null },
    );
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
      /* `date_trunc`: `defaultNow()` guarda microsegundos y el `Date` de JS solo
         milisegundos; sin truncar, una fila recién creada no casaría nunca.
         `::timestamp` sobre el ISO en UTC, igual que guarda drizzle. */
      ...(esperado
        ? {
            setWhere: sql`date_trunc('milliseconds', ${suscripciones.updatedAt}) = ${esperado.toISOString()}::timestamp`,
          }
        : {}),
    })
    .returning();

  /* Sin fila devuelta: existía y su `updatedAt` ya no es el que vio el editor. */
  if (!row) {
    return NextResponse.json(
      {
        error:
          "El plan cambió mientras lo editabas (un pago o otro administrador). No se guardó nada: recarga la página y repite el cambio.",
      },
      { status: 409 },
    );
  }

  /* La ficha cacheada lleva la suscripción dentro (prueba, sello): sin esto el
     mapa y la lista enseñan el plan viejo hasta 5 minutos. */
  invalidarCatalogo();

  return NextResponse.json({
    ...row,
    planEfectivo: planEfectivo(aSuscripcion(row)),
  });
}
