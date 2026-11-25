import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { places, prospectos, users } from "@/lib/db/schema";
import {
  esEtapaProspecto,
  esOrigenProspecto,
} from "@/lib/prospectos";
import { obtenerProspectoAdmin } from "@/lib/prospectos-server";

type Params = { params: Promise<{ id: string }> };

function texto(valor: unknown, max: number): string | undefined {
  return typeof valor === "string" ? valor.trim().slice(0, max) : undefined;
}

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

/**
 * Mover de etapa o corregir el seguimiento de un prospecto.
 *
 * El cambio de etapa sella `etapa_cambiada_en`, que es la fecha que el tablero
 * enseña; editar notas o el próximo paso no la toca. La entrada de Actividad
 * distingue «movió» de «editó» para que el historial se lea solo.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const [actual] = await db
    .select()
    .from(prospectos)
    .where(eq(prospectos.id, id))
    .limit(1);
  if (!actual) {
    return NextResponse.json(
      { error: "Prospecto no encontrado" },
      { status: 404 },
    );
  }

  const cambios: Partial<typeof prospectos.$inferInsert> = {};

  for (const [campo, max] of [
    ["nombre", 160],
    ["provincia", 80],
    ["origenDetalle", 160],
    ["proximoPaso", 300],
    ["notas", 4000],
  ] as const) {
    if (body[campo] === undefined) continue;
    const valor = texto(body[campo], max);
    if (valor === undefined) {
      return NextResponse.json(
        { error: `El campo ${campo} no es válido.` },
        { status: 400 },
      );
    }
    if (campo === "nombre" || campo === "provincia") {
      if (!valor) {
        return NextResponse.json(
          { error: "El nombre y la provincia no pueden quedar vacíos." },
          { status: 400 },
        );
      }
      cambios[campo] = valor;
    } else if (campo === "origenDetalle") {
      cambios.origenDetalle = valor || null;
    } else {
      cambios[campo] = valor;
    }
  }

  if (body.origen !== undefined) {
    if (!esOrigenProspecto(body.origen)) {
      return NextResponse.json({ error: "El origen no es válido." }, { status: 400 });
    }
    cambios.origen = body.origen;
  }

  if (body.etapa !== undefined) {
    if (!esEtapaProspecto(body.etapa)) {
      return NextResponse.json({ error: "La etapa no es válida." }, { status: 400 });
    }
    cambios.etapa = body.etapa;
    if (body.etapa !== actual.etapa) cambios.etapaCambiadaEn = new Date();
  }

  if (body.proximoPasoEn !== undefined) {
    const valor = fecha(body.proximoPasoEn);
    if (valor === undefined) {
      return NextResponse.json(
        { error: "La fecha del próximo paso no es válida." },
        { status: 400 },
      );
    }
    cambios.proximoPasoEn = valor;
  }

  if (body.adminResponsableId !== undefined) {
    if (body.adminResponsableId === null || body.adminResponsableId === "") {
      cambios.adminResponsableId = null;
    } else if (
      typeof body.adminResponsableId === "string" &&
      (await esAdmin(body.adminResponsableId))
    ) {
      cambios.adminResponsableId = body.adminResponsableId;
    } else {
      return NextResponse.json(
        { error: "El responsable no es una cuenta de administración." },
        { status: 400 },
      );
    }
  }

  if (body.negocioId !== undefined) {
    if (body.negocioId === null || body.negocioId === "") {
      cambios.negocioId = null;
    } else if (
      typeof body.negocioId === "string" &&
      (await existeNegocio(body.negocioId))
    ) {
      cambios.negocioId = body.negocioId;
    } else {
      return NextResponse.json(
        { error: "El negocio enlazado no existe." },
        { status: 400 },
      );
    }
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json(
      { error: "No hay cambios para guardar." },
      { status: 400 },
    );
  }

  cambios.updatedAt = new Date();
  const [actualizado] = await db
    .update(prospectos)
    .set(cambios)
    .where(eq(prospectos.id, id))
    .returning({ id: prospectos.id, nombre: prospectos.nombre });
  if (!actualizado) {
    return NextResponse.json(
      { error: "Prospecto no encontrado" },
      { status: 404 },
    );
  }

  const movio = cambios.etapa !== undefined && cambios.etapa !== actual.etapa;
  await registrarActividad({
    accion: movio ? ACCION.moverProspecto : ACCION.editarProspecto,
    objetoTipo: "prospecto",
    objetoId: actualizado.id,
    resumen: movio
      ? `Movió el prospecto «${actualizado.nombre}» a ${cambios.etapa}`
      : `Editó el prospecto «${actualizado.nombre}»`,
    datos: {
      etapaAnterior: actual.etapa,
      etapaNueva: cambios.etapa ?? actual.etapa,
      negocioId: cambios.negocioId ?? actual.negocioId,
    },
  });

  return NextResponse.json(await obtenerProspectoAdmin(id));
}
