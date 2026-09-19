import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { toPlaceValues, toUserPlace } from "@/lib/db/mappers";
import { getPlaceById, resolveCategoryId } from "@/lib/db/queries";
import type { UserPlace } from "@/lib/places-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const place = await getPlaceById(id);
  if (!place) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }
  return NextResponse.json(place);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  let body: Partial<UserPlace>;
  try {
    body = (await req.json()) as Partial<UserPlace>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name === "") {
    return NextResponse.json({ error: "El nombre no puede quedar vacío" }, { status: 400 });
  }
  if (body.lat !== undefined && !Number.isFinite(body.lat)) {
    return NextResponse.json({ error: "Latitud inválida" }, { status: 400 });
  }
  if (body.lng !== undefined && !Number.isFinite(body.lng)) {
    return NextResponse.json({ error: "Longitud inválida" }, { status: 400 });
  }

  /* Solo se resuelve la categoría si el cuerpo la trae. Si no viene, `values`
     no toca `category_id` y la que tenía se queda. */
  let categoryId: string | null = null;
  if (body.category !== undefined) {
    categoryId = await resolveCategoryId(body.category);
    if (!categoryId) {
      return NextResponse.json(
        { error: `La categoría «${body.category}» no existe.` },
        { status: 400 },
      );
    }
  }

  const values = toPlaceValues(name === undefined ? body : { ...body, name }, categoryId);
  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "No hay nada que actualizar" }, { status: 400 });
  }

  const [row] = await db.update(places).set(values).where(eq(places.id, id)).returning();
  if (!row) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }

  /* La categoría puede haber cambiado: se relee para devolver la etiqueta nueva
     en vez de la que mandó el cliente, que podría ser otra. */
  const updated = await getPlaceById(id);
  return NextResponse.json(updated ?? toUserPlace({ ...row, categoryName: null }));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const [row] = await db.delete(places).where(eq(places.id, id)).returning({ id: places.id });

  if (!row) {
    return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ id: row.id });
}
