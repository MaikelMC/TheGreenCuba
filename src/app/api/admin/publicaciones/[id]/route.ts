import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { publicaciones } from "@/lib/db/schema";
import { toPublicacion } from "@/lib/db/mappers";
import { planearEdicionPublicacion } from "@/lib/publicaciones";

type Params = { params: Promise<{ id: string }> };

/**
 * Editar una publicación de la cola: el texto, la imagen, el estado y —al
 * publicarla— el enlace del post.
 *
 * El paso que importa es **marcar publicada**, y exige el enlace: Facebook no se
 * puede postear desde aquí, así que el estado es una afirmación de que alguien
 * lo hizo a mano, y sin el enlace esa afirmación no se puede comprobar. Al
 * volver atrás se limpia el enlace y la fecha, que ya no describen nada.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON inválido" },
      { status: 400 },
    );
  }

  const [actual] = await db
    .select()
    .from(publicaciones)
    .where(eq(publicaciones.id, id))
    .limit(1);
  if (!actual) {
    return NextResponse.json(
      { error: "Publicación no encontrada" },
      { status: 404 },
    );
  }

  /* Las reglas de la edición —qué exige publicar, qué limpia volver atrás, qué
     contenido vale— viven en `planearEdicionPublicacion`, que es puro y se
     prueba sin base. Aquí solo queda traducir su resultado a columnas. */
  const edicion = planearEdicionPublicacion(
    {
      texto: actual.texto,
      imagenUrl: actual.imagenUrl,
      estado: actual.estado,
      enlace: actual.enlace,
    },
    body,
  );
  if (typeof edicion === "string") {
    return NextResponse.json({ error: edicion }, { status: 400 });
  }

  /* Sin ninguna llave no hay cambio que guardar. */
  if (Object.keys(edicion).length === 0) {
    return NextResponse.json(
      { error: "No hay nada que actualizar" },
      { status: 400 },
    );
  }

  /* `publicadaEn` sale del `set` como booleano —«sellarla», «borrarla»— y se
     convierte aquí, que es donde hay un «ahora». Ausente no toca la columna. */
  const { publicadaEn, ...campos } = edicion;
  const set: Partial<typeof publicaciones.$inferInsert> = {
    ...campos,
    updatedAt: new Date(),
  };
  if (publicadaEn !== undefined) {
    set.publicadaEn = publicadaEn ? new Date() : null;
  }

  const [row] = await db
    .update(publicaciones)
    .set(set)
    .where(eq(publicaciones.id, id))
    .returning();

  return NextResponse.json(toPublicacion(row!));
}

/** Sacar una publicación de la cola. Solo administración. */
export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const [row] = await db
    .delete(publicaciones)
    .where(eq(publicaciones.id, id))
    .returning({ id: publicaciones.id });

  if (!row) {
    return NextResponse.json(
      { error: "Publicación no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json({ id: row.id });
}
