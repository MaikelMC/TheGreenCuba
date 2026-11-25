import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { places, prospectos, users } from "@/lib/db/schema";
import {
  esEtapaProspecto,
  esOrigenProspecto,
  type EtapaProspecto,
  type OrigenProspecto,
} from "@/lib/prospectos";
import { listarProspectosAdmin, obtenerProspectoAdmin } from "@/lib/prospectos-server";
import { generateId } from "@/lib/utils";

/**
 * Los prospectos comerciales, para administración.
 *
 * El alta y la lista viven aquí; mover de etapa y editar van por `[id]`. Toda
 * escritura comprueba el rol en el servidor y deja su entrada en Actividad.
 */

function texto(valor: unknown, max: number): string | undefined {
  return typeof valor === "string" ? valor.trim().slice(0, max) : undefined;
}

/** `YYYY-MM-DD` al mediodía UTC: el mismo día en La Habana. */
function fecha(valor: unknown): Date | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null || valor === "") return null;
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return undefined;
  }
  const fecha = new Date(`${valor}T12:00:00.000Z`);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}

async function esAdmin(valor: string): Promise<boolean> {
  const [fila] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, valor))
    .limit(1);
  return fila?.role === "admin";
}

async function existeNegocio(valor: string): Promise<boolean> {
  const [fila] = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.id, valor))
    .limit(1);
  return Boolean(fila);
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json({ prospectos: await listarProspectosAdmin() });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const nombre = texto(body.nombre, 160);
  const provincia = texto(body.provincia, 80);
  if (!nombre || !provincia) {
    return NextResponse.json(
      { error: "Escribe el nombre y la provincia del prospecto." },
      { status: 400 },
    );
  }

  const origen: OrigenProspecto = esOrigenProspecto(body.origen)
    ? body.origen
    : "visita_propia";
  const etapa: EtapaProspecto = esEtapaProspecto(body.etapa)
    ? body.etapa
    : "contactado";
  const proximoPasoEn = fecha(body.proximoPasoEn);
  if (proximoPasoEn === undefined) {
    return NextResponse.json(
      { error: "La fecha del próximo paso no es válida." },
      { status: 400 },
    );
  }

  const actual = await getAppUser();
  let adminResponsableId: string | null =
    typeof body.adminResponsableId === "string" && body.adminResponsableId
      ? body.adminResponsableId
      : actual?.role === "admin"
        ? actual.id
        : null;
  if (adminResponsableId && !(await esAdmin(adminResponsableId))) {
    return NextResponse.json(
      { error: "El responsable no es una cuenta de administración." },
      { status: 400 },
    );
  }

  const negocioId =
    typeof body.negocioId === "string" && body.negocioId.trim()
      ? body.negocioId.trim()
      : null;
  if (negocioId && !(await existeNegocio(negocioId))) {
    return NextResponse.json(
      { error: "El negocio enlazado no existe." },
      { status: 400 },
    );
  }

  const id = generateId();
  try {
    await db.insert(prospectos).values({
      id,
      nombre,
      provincia,
      origen,
      origenDetalle: texto(body.origenDetalle, 160) || null,
      etapa,
      proximoPaso: texto(body.proximoPaso, 300) ?? "",
      proximoPasoEn,
      notas: texto(body.notas, 4000) ?? "",
      adminResponsableId,
      negocioId,
    });
  } catch (error) {
    console.error("[api/admin/prospectos] database unavailable", error);
    return NextResponse.json(
      { error: "No se pudo guardar el prospecto." },
      { status: 503 },
    );
  }

  await registrarActividad({
    accion: ACCION.crearProspecto,
    objetoTipo: "prospecto",
    objetoId: id,
    resumen: `Creó el prospecto «${nombre}»`,
    datos: { origen, etapa, provincia, negocioId },
  });

  const creado = await obtenerProspectoAdmin(id);
  return NextResponse.json(creado, { status: 201 });
}
