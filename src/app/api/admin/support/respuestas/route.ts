import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { listarRespuestasGuardadas } from "@/lib/admin-soporte";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { supportSavedReplies } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";

/**
 * Respuestas guardadas de Soporte.
 *
 * Son textos editables por los administradores y no dependen de un ticket
 * concreto. Cada alta, edición o borrado deja entrada en Actividad.
 */

function texto(
  valor: unknown,
  minimo: number,
  maximo: number,
): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  if (limpio.length < minimo || limpio.length > maximo) return null;
  return limpio;
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return NextResponse.json({ respuestas: await listarRespuestasGuardadas() });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    titulo?: unknown;
    cuerpo?: unknown;
  } | null;
  const titulo = texto(body?.titulo, 3, 80);
  const cuerpo = texto(body?.cuerpo, 5, 1200);

  if (!titulo || !cuerpo) {
    return NextResponse.json(
      {
        error:
          "El título debe tener entre 3 y 80 caracteres y el texto entre 5 y 1200.",
      },
      { status: 400 },
    );
  }

  const usuario = await getAppUser();
  const [fila] = await db
    .insert(supportSavedReplies)
    .values({
      id: generateId(),
      title: titulo,
      body: cuerpo,
      createdBy: usuario?.id ?? null,
    })
    .returning();

  await registrarActividad({
    accion: ACCION.editarRespuestaGuardada,
    objetoTipo: "respuesta_guardada",
    objetoId: fila?.id ?? null,
    resumen: `Creó la respuesta guardada «${titulo}»`,
  });

  return NextResponse.json({ respuesta: fila }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    titulo?: unknown;
    cuerpo?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const titulo = texto(body?.titulo, 3, 80);
  const cuerpo = texto(body?.cuerpo, 5, 1200);

  if (!id || !titulo || !cuerpo) {
    return NextResponse.json(
      { error: "Revisa el título y el texto de la respuesta." },
      { status: 400 },
    );
  }

  const [fila] = await db
    .update(supportSavedReplies)
    .set({ title: titulo, body: cuerpo })
    .where(eq(supportSavedReplies.id, id))
    .returning();

  if (!fila) {
    return NextResponse.json(
      { error: "Respuesta guardada no encontrada" },
      { status: 404 },
    );
  }

  await registrarActividad({
    accion: ACCION.editarRespuestaGuardada,
    objetoTipo: "respuesta_guardada",
    objetoId: id,
    resumen: `Editó la respuesta guardada «${titulo}»`,
  });

  return NextResponse.json({ respuesta: fila });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "Respuesta inválida" }, { status: 400 });
  }

  const [fila] = await db
    .delete(supportSavedReplies)
    .where(eq(supportSavedReplies.id, id))
    .returning();

  if (!fila) {
    return NextResponse.json(
      { error: "Respuesta guardada no encontrada" },
      { status: 404 },
    );
  }

  await registrarActividad({
    accion: ACCION.editarRespuestaGuardada,
    objetoTipo: "respuesta_guardada",
    objetoId: id,
    resumen: `Eliminó la respuesta guardada «${fila.title}»`,
  });

  return NextResponse.json({ id });
}
