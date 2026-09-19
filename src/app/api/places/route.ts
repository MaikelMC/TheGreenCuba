import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { toNewPlaceValues, toUserPlace } from "@/lib/db/mappers";
import { listPlaces, resolveCategoryId } from "@/lib/db/queries";
import { generateId } from "@/lib/utils";
import type { UserPlace } from "@/lib/places-store";

/**
 * Lista y alta de negocios.
 *
 * Devuelve `UserPlace[]` ya traducido: el cliente no ve `snake_case`, ni `Date`,
 * ni `category_id`. La distancia no se ordena aquí — el catálogo es de una sola
 * ciudad y el home ya calcula su etiqueta en el navegador, que es donde está la
 * ubicación del usuario.
 *
 * Los parámetros `lat` y `lng` que aceptaba antes se han quitado: se leían y no
 * se usaban para nada, así que quien los mandaba creía estar ordenando por
 * cercanía y recibía el orden de la base.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const items = await listPlaces({
    city: searchParams.get("city"),
    categorySlug: searchParams.get("category"),
    /* Sin `?active=true` devuelve todo a propósito: el panel de admin necesita
       ver los negocios cerrados para poder reabrirlos. */
    onlyActive: searchParams.get("active") === "true",
    limit: Number(searchParams.get("limit") ?? 200) || 200,
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  /* Escribir sí exige sesión de administrador. Leer no: el catálogo es público,
     que es el producto. */
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Partial<UserPlace>;
  try {
    body = (await req.json()) as Partial<UserPlace>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  /* Validación en la frontera: esto viene del navegador y termina en un INSERT.
     `Number.isFinite` descarta `undefined`, `null`, `NaN` y las cadenas. */
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
    return NextResponse.json(
      { error: "Hacen falta coordenadas válidas: el negocio no se puede situar en el mapa." },
      { status: 400 },
    );
  }

  /* `category_id` es `notNull` y tiene clave foránea, así que una categoría
     inventada no se puede guardar. Mejor un 400 que explique qué pasa que un
     error de Postgres a medio camino. */
  const categoryId = await resolveCategoryId(body.category);
  if (!categoryId) {
    return NextResponse.json(
      { error: `La categoría «${body.category ?? ""}» no existe.` },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(places)
    .values(toNewPlaceValues(body, categoryId, generateId()))
    .returning();

  return NextResponse.json(
    toUserPlace({ ...row!, categoryName: body.category ?? null }),
    { status: 201 },
  );
}
