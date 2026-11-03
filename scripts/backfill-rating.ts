import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Pone `places.rating` al promedio real de sus reseñas.
 *
 * Hasta ahora nadie escribía esa columna: la media se calculaba al vuelo solo
 * en la ficha y el directorio ordenaba por un valor de siembra que el paso del
 * tiempo fue dejando viejo. Este script la deja cuadrada una vez; a partir de
 * aquí la mantiene `POST /api/reviews`.
 *
 * **Solo escribe los lugares que tienen reseñas.** Un lugar con un `rating`
 * sembrado y ninguna reseña se queda como está: ponerlo a `null` borraría un
 * dato que nadie ha sustituido por otro.
 *
 * Uso:
 *   npx tsx --env-file-if-exists=.env scripts/backfill-rating.ts
 *   npx tsx --env-file-if-exists=.env scripts/backfill-rating.ts --apply
 */

const aplicar = process.argv.includes("--apply");

async function main() {
  const stats = await db
    .select({
      placeId: schema.reviews.placeId,
      promedio: sql<number>`avg(${schema.reviews.rating})::float`,
      total: sql<number>`count(*)::int`,
    })
    .from(schema.reviews)
    .groupBy(schema.reviews.placeId);

  let cambiados = 0;

  for (const row of stats) {
    const [place] = await db
      .select({ rating: schema.places.rating })
      .from(schema.places)
      .where(eq(schema.places.id, row.placeId))
      .limit(1);

    if (!place) continue; // reseña huérfana: la FK ya no debería permitirlo
    /* La columna es `doublePrecision`, no un entero: se compara con margen
       para no reescribir por ruido de coma flotante. */
    if (place.rating !== null && Math.abs(place.rating - row.promedio) < 0.001) {
      continue;
    }

    cambiados += 1;
    console.log(
      `${aplicar ? "✍️ " : "·  "} ${row.placeId}: ${place.rating ?? "—"} → ${row.promedio.toFixed(2)} (${row.total} reseñas)`,
    );
    if (aplicar) {
      await db
        .update(schema.places)
        .set({ rating: row.promedio })
        .where(eq(schema.places.id, row.placeId));
    }
  }

  console.log(
    `${aplicar ? "✅" : "ℹ️ "} ${cambiados} lugares ${aplicar ? "actualizados" : "por actualizar"} de ${stats.length} con reseñas.`,
  );
}

main().catch((error) => {
  console.error("❌", error);
  process.exit(1);
});
