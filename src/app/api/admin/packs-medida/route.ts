import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { db } from "@/lib/db";
import { packsMedida, places } from "@/lib/db/schema";
import { funcionesDeServicios, precioSugeridoPack } from "@/lib/pack-medida";
import { MODULOS, PACKS } from "@/lib/plans";
import { generateId } from "@/lib/utils";

const SERVICIOS_VALIDOS = new Set([
  ...Object.keys(MODULOS),
  ...Object.keys(PACKS),
]);

const COLS = {
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
};

function serializar(row: {
  id: string;
  negocioId: string;
  estado: string;
  serviciosSolicitados: string[];
  servicios: string[];
  funciones: string[];
  precioUsd: number | null;
  precioSugeridoUsd: number | null;
  oferta2x1: boolean;
  notaCliente: string | null;
  notaInterna: string | null;
  enviadoEn: Date | null;
  pagadoEn: Date | null;
  venceEn: Date | null;
  creadoEn: Date;
  actualizadoEn: Date;
  negocioNombre: string;
}) {
  return {
    ...row,
    enviadoEn: row.enviadoEn?.toISOString() ?? null,
    pagadoEn: row.pagadoEn?.toISOString() ?? null,
    venceEn: row.venceEn?.toISOString() ?? null,
    creadoEn: row.creadoEn.toISOString(),
    actualizadoEn: row.actualizadoEn.toISOString(),
  };
}

/**
 * GET — lista de solicitudes pendientes (todos los negocios) o historial de uno.
 *
 * Sin `placeId`: devuelve los packs en tramitación (solicitado|borrador|enviado)
 * de todos los negocios, ordenados por fecha de creación desc.
 * Con `placeId`: devuelve el historial completo de ese negocio.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const placeId = req.nextUrl.searchParams.get("placeId")?.trim();

  const rows = await db
    .select(COLS)
    .from(packsMedida)
    .innerJoin(places, eq(packsMedida.negocioId, places.id))
    .where(
      placeId
        ? eq(packsMedida.negocioId, placeId)
        : inArray(packsMedida.estado, ["solicitado", "borrador", "enviado"]),
    )
    .orderBy(desc(packsMedida.creadoEn));

  return NextResponse.json({ packs: rows.map(serializar) });
}

/**
 * POST — el administrador crea un pack borrador para un negocio.
 *
 * Pensado para cuando administración abre el pack directamente (sin solicitud
 * previa del dueño). Si el negocio ya tiene uno pendiente, la DB lanza y se
 * devuelve 409.
 *
 * Body: { negocioId, servicios, precioUsd?, oferta2x1?, notaCliente?, notaInterna? }
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const negocioId =
    typeof body.negocioId === "string" ? body.negocioId.trim() : "";
  if (!negocioId) {
    return NextResponse.json({ error: "Falta negocioId" }, { status: 400 });
  }

  const servicios = Array.isArray(body.servicios)
    ? (body.servicios as unknown[])
        .filter((s): s is string => typeof s === "string" && SERVICIOS_VALIDOS.has(s))
        .slice(0, 50)
    : [];

  const cat = await cargarCatalogo();
  const funciones = funcionesDeServicios(servicios, cat);
  const { precioUsd: sugerido } = precioSugeridoPack(servicios, cat);

  const precioUsd =
    typeof body.precioUsd === "number" && body.precioUsd >= 0
      ? Math.round(body.precioUsd * 100) / 100
      : null;

  const oferta2x1 =
    typeof body.oferta2x1 === "boolean" ? body.oferta2x1 : false;

  const notaCliente =
    typeof body.notaCliente === "string" ? body.notaCliente.trim() || null : null;

  const notaInterna =
    typeof body.notaInterna === "string" ? body.notaInterna.trim() || null : null;

  const id = generateId();

  try {
    await db.insert(packsMedida).values({
      id,
      negocioId,
      estado: "borrador",
      serviciosSolicitados: [],
      servicios,
      funciones,
      precioUsd,
      precioSugeridoUsd: sugerido || null,
      oferta2x1,
      notaCliente,
      notaInterna,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("packs_medida_pendiente_idx")) {
      return NextResponse.json(
        { error: "Este negocio ya tiene un pack en tramitación." },
        { status: 409 },
      );
    }
    throw err;
  }

  const [row] = await db
    .select(COLS)
    .from(packsMedida)
    .innerJoin(places, eq(packsMedida.negocioId, places.id))
    .where(eq(packsMedida.id, id))
    .limit(1);

  return NextResponse.json({ pack: row ? serializar(row) : { id } }, { status: 201 });
}
