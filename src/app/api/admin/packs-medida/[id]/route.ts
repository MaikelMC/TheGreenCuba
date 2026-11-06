import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { db } from "@/lib/db";
import { packsMedida, places } from "@/lib/db/schema";
import { funcionesDeServicios, precioSugeridoPack } from "@/lib/pack-medida";
import { MODULOS, PACKS } from "@/lib/plans";
import type { PackMedidaEstado } from "@/lib/db/schema/packs_medida";

const SERVICIOS_VALIDOS = new Set([
  ...Object.keys(MODULOS),
  ...Object.keys(PACKS),
]);

/** Los estados que el administrador puede fijar desde el panel. */
const ESTADOS_ADMIN = new Set<string>(["borrador", "enviado", "cancelado", "rechazado"]);

/**
 * PATCH — el administrador edita un pack existente.
 *
 * Campos actualizables:
 *   servicios, precioUsd, oferta2x1, notaCliente, notaInterna, estado
 *
 * - Cambiar `servicios` recalcula `funciones` y `precioSugeridoUsd`.
 * - Pasar a `enviado` fija `enviadoEn` si aún no está.
 * - No se puede pasar a `pagado` ni `vencido` desde aquí; eso lo hace el webhook.
 * - Un pack en `pagado`, `vencido` o `cancelado` no se puede editar (409).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const [pack] = await db
    .select({ estado: packsMedida.estado, negocioId: packsMedida.negocioId, enviadoEn: packsMedida.enviadoEn })
    .from(packsMedida)
    .where(eq(packsMedida.id, id))
    .limit(1);

  if (!pack) return NextResponse.json({ error: "Pack no encontrado." }, { status: 404 });

  /* Los finalizados no se editan. */
  if (["pagado", "vencido"].includes(pack.estado)) {
    return NextResponse.json(
      { error: "Un pack pagado o vencido no se puede editar." },
      { status: 409 },
    );
  }

  const cambios: Partial<typeof packsMedida.$inferInsert> = {};

  /* Servicios → recalcular funciones y precio sugerido. */
  if (Array.isArray(body.servicios)) {
    const servicios = (body.servicios as unknown[])
      .filter((s): s is string => typeof s === "string" && SERVICIOS_VALIDOS.has(s))
      .slice(0, 50);
    const cat = await cargarCatalogo();
    const funciones = funcionesDeServicios(servicios, cat);
    const { precioUsd: sugerido } = precioSugeridoPack(servicios, cat);
    cambios.servicios = servicios;
    cambios.funciones = funciones;
    cambios.precioSugeridoUsd = sugerido || null;
  }

  if (typeof body.precioUsd === "number" && body.precioUsd >= 0) {
    cambios.precioUsd = Math.round(body.precioUsd * 100) / 100;
  } else if (body.precioUsd === null) {
    cambios.precioUsd = null;
  }

  if (typeof body.oferta2x1 === "boolean") cambios.oferta2x1 = body.oferta2x1;

  if (typeof body.notaCliente === "string")
    cambios.notaCliente = body.notaCliente.trim() || null;

  if (typeof body.notaInterna === "string")
    cambios.notaInterna = body.notaInterna.trim() || null;

  if (typeof body.estado === "string" && ESTADOS_ADMIN.has(body.estado)) {
    cambios.estado = body.estado as PackMedidaEstado;
    if (body.estado === "enviado" && !pack.enviadoEn) {
      cambios.enviadoEn = new Date();
    }
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "Sin cambios." }, { status: 400 });
  }

  await db
    .update(packsMedida)
    .set(cambios)
    .where(and(eq(packsMedida.id, id), eq(packsMedida.negocioId, pack.negocioId)));

  const [row] = await db
    .select({
      id: packsMedida.id,
      negocioId: packsMedida.negocioId,
      estado: packsMedida.estado,
      serviciosSolicitados: packsMedida.serviciosSolicitados,
      servicios: packsMedida.servicios,
      funciones: packsMedida.funciones,
      precioUsd: packsMedida.precioUsd,
      precioSugeridoUsd: packsMedida.precioSugeridoUsd,
      oferta2x1: packsMedida.oferta2x1,
      notaCliente: packsMedida.notaCliente,
      notaInterna: packsMedida.notaInterna,
      enviadoEn: packsMedida.enviadoEn,
      pagadoEn: packsMedida.pagadoEn,
      venceEn: packsMedida.venceEn,
      creadoEn: packsMedida.creadoEn,
      actualizadoEn: packsMedida.actualizadoEn,
      negocioNombre: places.name,
    })
    .from(packsMedida)
    .innerJoin(places, eq(packsMedida.negocioId, places.id))
    .where(eq(packsMedida.id, id))
    .limit(1);

  return NextResponse.json({
    pack: row
      ? {
          ...row,
          enviadoEn: row.enviadoEn?.toISOString() ?? null,
          pagadoEn: row.pagadoEn?.toISOString() ?? null,
          venceEn: row.venceEn?.toISOString() ?? null,
          creadoEn: row.creadoEn.toISOString(),
          actualizadoEn: row.actualizadoEn.toISOString(),
        }
      : { id },
  });
}
