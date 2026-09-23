import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { toBusinessCategory } from "@/lib/db/mappers";
import {
  CATALOG_TAG,
  categorySlugTaken,
  countPlacesInCategory,
  findCategoryBySlug,
} from "@/lib/db/queries";
import { slugify } from "@/lib/utils";

type Params = { params: Promise<{ slug: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { slug } = await params;

  let body: { name?: unknown; value?: unknown; emoji?: unknown; icon?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const values: Partial<typeof categories.$inferInsert> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "El nombre no puede quedar vacío" }, { status: 400 });
    }
    values.name = name;
  }
  if (typeof body.emoji === "string") values.emoji = body.emoji;
  if (typeof body.icon === "string") values.icon = body.icon;

  /* Cambiar la clave es renombrar la categoría para todo el que la use. Se
     permite, pero no puede pisar la de otra: el índice único lo rechazaría y el
     error saldría como un 500 opaco. */
  if (typeof body.value === "string" && slugify(body.value) !== slug) {
    const next = slugify(body.value);
    if (!next) {
      return NextResponse.json({ error: "La clave nueva no es válida." }, { status: 400 });
    }
    if (await categorySlugTaken(next)) {
      return NextResponse.json(
        { error: `Ya existe una categoría con la clave «${next}».` },
        { status: 409 },
      );
    }
    values.slug = next;
  }

  if (Object.keys(values).length === 0) {
    return NextResponse.json({ error: "No hay nada que actualizar" }, { status: 400 });
  }

  const [row] = await db
    .update(categories)
    .set(values)
    .where(eq(categories.slug, slug))
    .returning();

  if (!row) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  revalidateTag(CATALOG_TAG, "max");

  return NextResponse.json(toBusinessCategory(row));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { slug } = await params;
  const category = await findCategoryBySlug(slug);
  if (!category) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  /* `places.category_id` es `onDelete: restrict`. Se cuenta antes para poder
     decir cuántos negocios la bloquean, en vez de dejar que Postgres suelte un
     error de clave foránea que el usuario no puede interpretar. */
  const usos = await countPlacesInCategory(category.id);
  if (usos > 0) {
    return NextResponse.json(
      {
        error:
          usos === 1
            ? "No se puede borrar: hay 1 negocio en esta categoría."
            : `No se puede borrar: hay ${usos} negocios en esta categoría.`,
      },
      { status: 409 },
    );
  }

  await db.delete(categories).where(eq(categories.id, category.id));

  revalidateTag(CATALOG_TAG, "max");

  return NextResponse.json({ value: slug });
}
