import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { canManagePlace } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { publicaciones } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

/**
 * Sacar una publicación de la cola, desde el panel del negocio.
 *
 * El dueño **sí** puede borrar las suyas, y no es un extra: en Básico el tope es
 * una publicación por semana, así que sin poder borrar, una que salga mal le
 * cierra la semana entera. Borrar libera la plaza.
 *
 * Una ya publicada no se borra desde aquí: es el registro de que el post existe y
 * lleva el enlace que lo prueba. Esa la quita la administración.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;

  /* La fila primero: el negocio al que pertenece la publicación es lo que hay que
     comprobar, y sale de la propia fila. */
  const [actual] = await db
    .select({ negocioId: publicaciones.negocioId, estado: publicaciones.estado })
    .from(publicaciones)
    .where(eq(publicaciones.id, id))
    .limit(1);

  if (!actual) {
    return NextResponse.json(
      { error: "Publicación no encontrada" },
      { status: 404 },
    );
  }
  if (!(await canManagePlace(req, actual.negocioId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (actual.estado === "publicada") {
    return NextResponse.json(
      { error: "Una publicación ya publicada solo la puede quitar administración." },
      { status: 400 },
    );
  }

  const [row] = await db
    .delete(publicaciones)
    .where(eq(publicaciones.id, id))
    .returning({ id: publicaciones.id });

  /* Si no sale fila es que otra petición la borró entre el `select` de arriba y
     este `delete`: el resultado es el mismo que se buscaba, así que un 404. */
  if (!row) {
    return NextResponse.json(
      { error: "Publicación no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json({ id: row.id });
}
