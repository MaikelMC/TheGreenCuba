/**
 * Sistema de embeddings para La Verde (Neon PostgreSQL + pgvector + Cloudflare Workers AI)
 *
 * Flujo:
 *   lugar → texto optimizado → embedding (@cf/baai/bge-m3, 1024 dims) → Neon
 *
 * El texto que se embebe se construye con una plantilla fija para que el
 * vector capture los atributos que el usuario menciona en lenguaje natural:
 * tipo de lugar, ambiente, características, barrio y ciudad.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema/places";
import { categories } from "@/lib/db/schema/categories";
import {
  EMBEDDING_DIM,
  generateEmbedding,
  toPgVector,
} from "@/lib/ai/cloudflare";

/* ────────────────────────────────────────────────────────────────
   Tipos
──────────────────────────────────────────────────────────────── */

export interface PlaceEmbeddingInput {
  id: string;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  category: string;
  city: string;
  province?: string | null;
  neighborhood?: string | null;
  tags?: string[] | null;
  features?: Record<string, boolean | undefined> | null;
  vibe?: string[] | null;
  address?: string | null;
  slug: string;
  status?: string;
  paymentMethods?: string[] | null;
  currencies?: string[] | null;
  priceLevel?: number;
  imageUrls?: string[] | null;
  createdBy?: string | null;
}

export interface SearchResultRow {
  id: string;
  name: string;
  /** Nombre de la categoría (`c.name`), no el id: es lo que lee el modelo. */
  category: string;
  description: string | null;
  neighborhood: string | null;
  /** Distancia al usuario en metros. `null` si no se envió ubicación. */
  distance_m: number | null;
  similarity: number;
  [key: string]: unknown;
}

/* ────────────────────────────────────────────────────────────────
   Construcción del texto que se embebe
──────────────────────────────────────────────────────────────── */

export function buildEmbeddingText(place: PlaceEmbeddingInput): string {
  const parts: string[] = [];

  parts.push(`${place.name}`);
  parts.push(`Es un ${place.category.toLowerCase()} en ${place.city}`);

  if (place.province) parts.push(`, provincia de ${place.province}`);

  if (place.neighborhood) {
    parts.push(`, ubicado en el barrio de ${place.neighborhood}`);
  }

  const description =
    place.description?.trim() || place.shortDescription?.trim();
  if (description) parts.push(`. ${description}`);

  if (place.vibe && place.vibe.length > 0) {
    parts.push(
      `. Tiene ambiente de ${place.vibe
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
        .join(", ")}`,
    );
  }

  if (place.tags && place.tags.length > 0) {
    parts.push(
      `. Se describe como ${place.tags
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .join(", ")}`,
    );
  }

  const features = place.features ?? {};
  const featurePhrases: string[] = [];
  if (features.wifi) featurePhrases.push("tiene wifi o conexión a internet");
  if (features.terraza) featurePhrases.push("tiene terraza al aire libre");
  if (features.petFriendly)
    featurePhrases.push("acepta mascotas, es pet friendly");
  if (features.vegetarian) featurePhrases.push("ofrece opciones vegetarianas");
  if (features.enchufes)
    featurePhrases.push("tiene enchufes para cargar dispositivos");
  if (features.aireAcondicionado)
    featurePhrases.push("tiene aire acondicionado");
  if (features.musica) featurePhrases.push("pone música en vivo o de ambiente");
  if (features.estacionamiento)
    featurePhrases.push("tiene estacionamiento o parking");

  if (featurePhrases.length > 0) {
    parts.push(`. ${featurePhrases.join("; ")}`);
  }

  if (place.address) parts.push(`. Su dirección es ${place.address}`);

  /* Los fragmentos se unen con espacio y varios empiezan por «.» o «,», así que
     sin esto el texto que se embebe queda «…Santiago de Cuba , provincia de…» y
     «…de noche . Cocina criolla». No rompe nada, pero el vector sale de un
     texto peor escrito que el que escribimos. */
  return parts.join(" ").replace(/\s+([.,])/g, "$1");
}

/* ────────────────────────────────────────────────────────────────
   Generación del embedding
──────────────────────────────────────────────────────────────── */

export async function generatePlaceEmbedding(
  place: PlaceEmbeddingInput,
): Promise<number[]> {
  const text = buildEmbeddingText(place);
  const vector = await generateEmbedding(text);
  if (vector.length !== EMBEDDING_DIM) {
    throw new Error(
      `El embedding de ${place.name} devolvió ${vector.length} dimensiones, esperado ${EMBEDDING_DIM}.`,
    );
  }
  return vector;
}

/* ────────────────────────────────────────────────────────────────
   Insertar / actualizar lugar con embedding
──────────────────────────────────────────────────────────────── */

export async function upsertPlaceWithEmbedding(
  place: PlaceEmbeddingInput & {
    lat: number;
    lng: number;
    slug: string;
    status?: string;
  },
): Promise<string> {
  const vector = await generatePlaceEmbedding(place);
  const literal = toPgVector(vector);

  await db.execute(sql`
    INSERT INTO places (
      id, name, slug, description, short_description, category_id,
      lat, lng, address, city, province, neighborhood,
      payment_methods, currencies, price_level, vibe, tags,
      features, image_urls, embedding, is_active, status,
      created_by, created_at, updated_at
    )
    VALUES (
      ${place.id}, ${place.name}, ${place.slug},
      ${place.description ?? null}, ${place.shortDescription ?? null},
      ${place.category}, ${place.lat}, ${place.lng},
      ${place.address ?? null}, ${place.city}, ${place.province ?? null},
      ${place.neighborhood ?? null},
      ${place.paymentMethods ?? null}, ${place.currencies ?? null},
      ${place.priceLevel ?? 1}, ${place.vibe ?? null}, ${place.tags ?? null},
      ${place.features ? JSON.stringify(place.features) : null},
      ${place.imageUrls ? JSON.stringify(place.imageUrls) : null},
      ${literal}::vector, true, ${place.status ?? "active"},
      ${place.createdBy ?? null}, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      description = EXCLUDED.description,
      short_description = EXCLUDED.short_description,
      category_id = EXCLUDED.category_id,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      province = EXCLUDED.province,
      neighborhood = EXCLUDED.neighborhood,
      payment_methods = EXCLUDED.payment_methods,
      currencies = EXCLUDED.currencies,
      price_level = EXCLUDED.price_level,
      vibe = EXCLUDED.vibe,
      tags = EXCLUDED.tags,
      features = EXCLUDED.features,
      image_urls = EXCLUDED.image_urls,
      embedding = EXCLUDED.embedding,
      status = EXCLUDED.status,
      updated_at = NOW()
  `);

  return place.id;
}

/* ────────────────────────────────────────────────────────────────
   Regenerar todos los embeddings (batch)
──────────────────────────────────────────────────────────────── */

export interface RegenerateOptions {
  batchSize?: number;
  delayMs?: number;
  onProgress?: (done: number, total: number) => void;
}

export async function regenerateAllEmbeddings(
  opts: RegenerateOptions = {},
): Promise<{ regenerated: number; failed: string[] }> {
  const batchSize = opts.batchSize ?? 50;
  const delayMs = opts.delayMs ?? 1500;

  const rows = await db
    .select({ id: places.id })
    .from(places)
    .where(eq(places.isActive, true))
    .orderBy(sql`${places.createdAt} ASC`);

  /* El texto que se embebe lleva el NOMBRE de la categoría («Es un restaurante
     en…»), no su id. Pasando `categoryId` el vector se construía con «Es un
     cat_9f3… en Santiago de Cuba», así que buscar «cafetería» no acercaba a
     ninguna cafetería por su categoría y solo quedaba la coincidencia con la
     descripción. Son once filas: se leen una vez, no una por lugar. */
  const categoryName = new Map(
    (await db.select({ id: categories.id, name: categories.name }).from(categories)).map(
      (c) => [c.id, c.name],
    ),
  );

  let regenerated = 0;
  const failed: string[] = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (row) => {
        const placeRow = await db
          .select()
          .from(places)
          .where(eq(places.id, row.id))
          .limit(1)
          .then((r) => r[0]);

        if (!placeRow) return;

        const vector = await generatePlaceEmbedding({
          id: placeRow.id,
          name: placeRow.name,
          description: placeRow.description,
          shortDescription: placeRow.shortDescription,
          category: categoryName.get(placeRow.categoryId) ?? placeRow.categoryId,
          city: placeRow.city,
          province: placeRow.province,
          neighborhood: placeRow.neighborhood,
          tags: placeRow.tags,
          features: placeRow.features,
          vibe: placeRow.vibe,
          address: placeRow.address,
          slug: placeRow.slug,
          paymentMethods: placeRow.paymentMethods,
          currencies: placeRow.currencies,
          priceLevel: placeRow.priceLevel ?? 1,
          imageUrls: placeRow.imageUrls,
          createdBy: placeRow.createdBy,
        });

        await db
          .update(places)
          .set({ embedding: vector, updatedAt: new Date() })
          .where(eq(places.id, placeRow.id));
      }),
    );

    for (let j = 0; j < results.length; j += 1) {
      if (results[j]?.status === "rejected") {
        failed.push(batch[j]!.id);
      } else {
        regenerated += 1;
      }
    }

    opts.onProgress?.(regenerated, rows.length);

    if (i + batchSize < rows.length && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { regenerated, failed };
}

/* ────────────────────────────────────────────────────────────────
   Búsqueda semántica + geográfica
──────────────────────────────────────────────────────────────── */

export interface SearchOptions {
  origin?: { lat: number; lng: number } | null;
  candidates?: number;
  limit?: number;
  radiusM?: number | null;
}

const DEFAULT_CANDIDATES = 30;
const DEFAULT_LIMIT = 5;

export async function semanticGeoSearch(
  query: string,
  opts: SearchOptions = {},
): Promise<SearchResultRow[]> {
  const clean = query.trim();
  if (!clean) throw new Error("La consulta está vacía.");

  const vector = await generateEmbedding(clean);
  const literal = toPgVector(vector);

  const candidates = opts.candidates ?? DEFAULT_CANDIDATES;
  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, candidates);
  const origin = opts.origin ?? null;

  const distanceExpr = origin
    ? sql`(6371000 * acos(least(1, greatest(-1,
        cos(radians(${origin.lat})) * cos(radians(p.lat)) *
        cos(radians(p.lng) - radians(${origin.lng})) +
        sin(radians(${origin.lat})) * sin(radians(p.lat))
      ))))`
    : sql`NULL::double precision`;

  const rows = await db.execute<SearchResultRow>(sql`
    SELECT
      p.id,
      p.name,
      c.name AS category,
      p.short_description AS description,
      p.neighborhood,
      ${distanceExpr} AS distance_m,
      1 - (p.embedding <=> ${literal}::vector) AS similarity
    FROM places p
    JOIN categories c ON c.id = p.category_id
    WHERE p.is_active = true
      AND p.embedding IS NOT NULL
      ${origin && opts.radiusM ? sql`AND ${distanceExpr} <= ${opts.radiusM}` : sql``}
    ORDER BY p.embedding <=> ${literal}::vector
    LIMIT ${candidates}
  `);

  const found = rows.rows ?? [];

  /* `distance_m` y no `distanceM`: `db.execute` nombra las columnas como las
     nombra el SQL, no en camelCase. Leer `distanceM` daba `undefined`,
     `undefined / 2000` es NaN, el score salía NaN para todas las filas y el
     reordenado por cercanía se quedaba en nada — en silencio, porque las filas
     sí llegaban. */
  const scored = found
    .map((p) => ({
      ...p,
      score:
        p.distance_m === null
          ? p.similarity
          : p.similarity * 0.6 + (1 / (1 + p.distance_m / 2000)) * 0.4,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ score: _score, ...rest }) => rest);
}

export { places };
