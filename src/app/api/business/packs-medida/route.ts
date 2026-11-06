import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { accesoNegocio } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { notifications, packsMedida } from "@/lib/db/schema";
import { MODULOS, PACKS } from "@/lib/plans";
import { packMedidaDe } from "@/lib/plans-server";
import { generateId } from "@/lib/utils";

const SERVICIOS_VALIDOS = new Set([
  ...Object.keys(MODULOS),
  ...Object.keys(PACKS),
]);

/**
 * POST — el dueño solicita un pack a medida.
 *
 * Body: { placeId: string; serviciosSolicitados: string[] }
 *
 * Solo el dueño puede solicitarlo. Los trabajadores ven el pack pero no pueden
 * pedirlo. La regla «uno pendiente» la garantiza el índice parcial de la tabla;
 * si ya hay uno, la inserción lanza y se devuelve 409.
 *
 * GET — el estado actual del pack (si lo hay) del negocio.
 */
export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId")?.trim() ?? "";
  if (!placeId) {
    return NextResponse.json({ error: "Falta placeId" }, { status: 400 });
  }

  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const acceso = await accesoNegocio(user, placeId);
  if (!acceso) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const pack = await packMedidaDe(placeId);
  return NextResponse.json({ pack });
}

export async function POST(req: NextRequest) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let body: { placeId?: unknown; serviciosSolicitados?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
  if (!placeId) {
    return NextResponse.json({ error: "Falta placeId" }, { status: 400 });
  }

  const acceso = await accesoNegocio(user, placeId);
  if (!acceso) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  /* Pagos y contratos son del dueño; los trabajadores ven pero no solicitan. */
  if (!acceso.esDueno) {
    return NextResponse.json(
      { error: "Solo el dueño puede solicitar un pack a medida." },
      { status: 403 },
    );
  }

  const serviciosSolicitados = Array.isArray(body.serviciosSolicitados)
    ? (body.serviciosSolicitados as unknown[])
        .filter((s): s is string => typeof s === "string" && SERVICIOS_VALIDOS.has(s))
        .slice(0, 50)
    : [];

  if (serviciosSolicitados.length === 0) {
    return NextResponse.json(
      { error: "Elige al menos un servicio." },
      { status: 400 },
    );
  }

  const id = generateId();

  try {
    await db.insert(packsMedida).values({
      id,
      negocioId: placeId,
      estado: "solicitado",
      serviciosSolicitados,
      servicios: [],
      funciones: [],
      creadoPor: user.id,
    });
  } catch (err) {
    /* El índice parcial único lanza cuando ya hay un pack pendiente. */
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("packs_medida_pendiente_idx")) {
      return NextResponse.json(
        { error: "Ya tienes un pack en tramitación. Espera a que se resuelva antes de pedir otro." },
        { status: 409 },
      );
    }
    throw err;
  }

  /* Notificación in-app: el dueño sabe que llegó y qué esperar. */
  await db.insert(notifications).values({
    id: generateId(),
    userId: user.id,
    type: "pack_medida_solicitado",
    title: "Pack a medida solicitado",
    message:
      "Hemos recibido tu solicitud. El equipo de La Verde la revisará y te enviará una propuesta con el precio en menos de 24 horas.",
    placeId,
  });

  const [row] = await db
    .select({
      id: packsMedida.id,
      estado: packsMedida.estado,
      servicios: packsMedida.servicios,
      funciones: packsMedida.funciones,
      precioUsd: packsMedida.precioUsd,
      oferta2x1: packsMedida.oferta2x1,
      notaCliente: packsMedida.notaCliente,
      venceEn: packsMedida.venceEn,
      enviadoEn: packsMedida.enviadoEn,
      pagadoEn: packsMedida.pagadoEn,
    })
    .from(packsMedida)
    .where(eq(packsMedida.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Error inesperado al crear el pack." }, { status: 500 });
  }

  return NextResponse.json(
    {
      pack: {
        id: row.id,
        estado: row.estado,
        servicios: row.servicios,
        funciones: row.funciones,
        precioUsd: row.precioUsd ?? null,
        oferta2x1: row.oferta2x1,
        notaCliente: row.notaCliente,
        venceEn: row.venceEn?.toISOString() ?? null,
        enviadoEn: row.enviadoEn?.toISOString() ?? null,
        pagadoEn: row.pagadoEn?.toISOString() ?? null,
      },
    },
    { status: 201 },
  );
}
