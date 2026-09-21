import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, placeImages, places } from "@/lib/db/schema";
import type { UserPlacePhoto } from "@/lib/places-store";
import {
  toBusinessCategory,
  toUserPlace,
  type PlaceRowWithCategory,
} from "./mappers";

/**
 * Las consultas que comparten las rutas de API.
 *
 * Están juntas y no repartidas por cada `route.ts` porque las usan las tres
 * —listar, leer una, crear, editar— y la traducción de fila a tipo de cliente
 * tiene que ocurrir en un solo sitio. Las rutas se quedan con lo suyo: validar
 * la entrada y decidir el código de estado.
 */

const SELECT_WITH_CATEGORY = { place: places, categoryName: categories.name };

function unwrap(row: { place: typeof places.$inferSelect; categoryName: string | null }): PlaceRowWithCategory {
  return { ...row.place, categoryName: row.categoryName };
}

/**
 * Las fotos de varios negocios, agrupadas por negocio.
 *
 * Va en un segundo viaje y no en un JOIN con `place_images`. Uno a varios en un
 * `select` plano duplica la fila del negocio por cada foto que tenga, y luego
 * hay que desduplicar en JavaScript igualmente. Dos consultas se leen mejor, y
 * con `inArray` el catálogo entero sigue costando un solo viaje.
 *
 * El orden es el que quiere el carrusel: la portada primero. En Postgres, un
 * `ORDER BY` descendente sobre un booleano pone `true` delante de `false`, que
 * es justo lo que hace falta.
 */
async function photosByPlace(ids: string[]): Promise<Map<string, UserPlacePhoto[]>> {
  const grouped = new Map<string, UserPlacePhoto[]>();
  if (ids.length === 0) return grouped;

  const rows = await db
    .select()
    .from(placeImages)
    .where(inArray(placeImages.placeId, ids))
    .orderBy(desc(placeImages.isCover), asc(placeImages.sortOrder), asc(placeImages.createdAt));

  for (const row of rows) {
    const photo: UserPlacePhoto = {
      url: row.url,
      alt: row.alt,
      width: row.width,
      height: row.height,
      isCover: row.isCover,
    };
    const list = grouped.get(row.placeId);
    if (list) list.push(photo);
    else grouped.set(row.placeId, [photo]);
  }

  return grouped;
}

export interface ListPlacesOptions {
  city?: string | null;
  /** Slug de la categoría («restaurante»), no su etiqueta. */
  categorySlug?: string | null;
  /** Sin especificar devuelve todo, que es lo que necesita el panel de admin:
      un negocio cerrado tiene que seguir apareciendo para poder reabrirlo. */
  onlyActive?: boolean;
  limit?: number;
}

export async function listPlaces(options: ListPlacesOptions = {}) {
  const filters = [];
  if (options.city) filters.push(eq(places.city, options.city));
  if (options.categorySlug) filters.push(eq(categories.slug, options.categorySlug));
  if (options.onlyActive) filters.push(eq(places.isActive, true));

  const rows = await db
    .select(SELECT_WITH_CATEGORY)
    .from(places)
    .leftJoin(categories, eq(categories.id, places.categoryId))
    /* Un solo `where` con `and(...)`. Antes se llamaba a `.where()` dos veces y
       en drizzle la segunda **sustituye** a la primera, así que filtrar por
       ciudad y categoría a la vez aplicaba solo la categoría y devolvía
       negocios de otra ciudad sin avisar. */
    .where(filters.length > 0 ? and(...filters) : undefined)
    .limit(Math.min(options.limit ?? 200, 500));

  const photos = await photosByPlace(rows.map((row) => row.place.id));

  return rows.map((row) =>
    toUserPlace({ ...unwrap(row), photos: photos.get(row.place.id) ?? [] }),
  );
}

export async function getPlaceById(id: string) {
  const [row] = await db
    .select(SELECT_WITH_CATEGORY)
    .from(places)
    .leftJoin(categories, eq(categories.id, places.categoryId))
    .where(eq(places.id, id))
    .limit(1);

  if (!row) return null;

  const photos = await photosByPlace([row.place.id]);
  return toUserPlace({ ...unwrap(row), photos: photos.get(row.place.id) ?? [] });
}

/** Clave foránea a partir de la etiqueta («Restaurante»). `null` si no existe. */
export async function resolveCategoryId(label: string | null | undefined): Promise<string | null> {
  const name = label?.trim();
  if (!name) return null;
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, name))
    .limit(1);
  return row?.id ?? null;
}

export async function listCategories() {
  const rows = await db.select().from(categories).orderBy(categories.sortOrder);
  return rows.map(toBusinessCategory);
}

/** `true` si el slug ya lo usa otra categoría. El índice único lo rechazaría
    igual, pero un 409 con nombre es mejor que un error de Postgres. */
export async function categorySlugTaken(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return Boolean(row);
}

export async function findCategoryBySlug(slug: string) {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return row ?? null;
}

/** Cuántos negocios cuelgan de una categoría. `places.category_id` es
    `onDelete: restrict`, así que borrarla con negocios dentro falla — mejor
    contarlos antes y decirlo con un número. */
export async function countPlacesInCategory(categoryId: string): Promise<number> {
  const rows = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.categoryId, categoryId));
  return rows.length;
}
