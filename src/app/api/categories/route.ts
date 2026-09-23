import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { toBusinessCategory } from "@/lib/db/mappers";
import { CATALOG_TAG, categorySlugTaken, listCategories } from "@/lib/db/queries";
import { generateId, slugify } from "@/lib/utils";
import { BUSINESS_CATEGORIES } from "@/lib/places";

/**
 * Categorías del catálogo.
 *
 * El cliente las identifica por `value` —un slug legible como «restaurante»— y
 * no por el `id` de la base, que es un aleatorio. Por eso las rutas de una
 * categoría concreta van por slug.
 */

export async function GET() {
  return NextResponse.json(await listCategories());
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { name?: unknown; value?: unknown; emoji?: unknown; icon?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  /* El slug se deriva del nombre si no viene: es lo que el formulario usa como
     clave, y dejar que llegue vacío lo convertiría en una categoría imposible
     de seleccionar. */
  const slug = slugify(
    typeof body.value === "string" && body.value.trim() ? body.value.trim() : name,
  );
  if (!slug) {
    return NextResponse.json(
      { error: "El nombre no produce una clave válida: usa letras o números." },
      { status: 400 },
    );
  }
  if (await categorySlugTaken(slug)) {
    return NextResponse.json(
      { error: `Ya existe una categoría con la clave «${slug}».` },
      { status: 409 },
    );
  }

  const [row] = await db
    .insert(categories)
    .values({
      id: generateId(),
      name,
      slug,
      emoji: typeof body.emoji === "string" ? body.emoji : null,
      icon: typeof body.icon === "string" ? body.icon : null,
      /* Al final de la lista: insertar en medio obligaría a recolocar el resto
         y el orden es solo cosmético. */
      sortOrder: BUSINESS_CATEGORIES.length,
    })
    .returning();

  revalidateTag(CATALOG_TAG, "max");

  return NextResponse.json(toBusinessCategory(row!), { status: 201 });
}
