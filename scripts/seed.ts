import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { regenerateAllEmbeddings } from "@/lib/ai/embedding";
import { BUSINESS_CATEGORIES } from "@/lib/places";
import { slugify, generateId } from "@/lib/utils";
import { SEED_PLACES } from "./seed-data";

/**
 * Puebla Neon con el catálogo inicial.
 *
 * Es idempotente y **no destructivo fuera del catálogo**: antes de insertar
 * borra las categorías y los lugares cuyos `slug` salen de este mismo archivo.
 * Hace falta porque la primera siembra usó ids aleatorios y esta usa los del
 * catálogo («primos-twice»), y el índice único de `places.slug` chocaba: el
 * `onConflictDoNothing` habría dejado las filas viejas y no habría insertado
 * ninguna nueva. Un negocio que no venga de aquí no se toca.
 *
 * Las categorías salen de `BUSINESS_CATEGORIES`, el mismo vocabulario que usa
 * el cliente, para que la etiqueta de un lugar cuadre con el `name` de su
 * categoría sin tabla de equivalencias.
 */

const CATEGORY_ROWS = BUSINESS_CATEGORIES.map((c, i) => ({
  id: generateId(),
  name: c.label,
  slug: c.value,
  icon: c.icon ?? "MapPin",
  emoji: c.emoji,
  sortOrder: i + 1,
}));

async function seed() {
  console.log("🌱 Seeding database...");

  /* Por NOMBRE y no por `slug`. El slug de la siembra anterior salía de
     `slugify(name)` («casa-de-la-trova-pepe-sanchez») y el de esta es el id del
     catálogo («casa-de-la-trova»): borrando por slug las filas viejas se
     quedaban, y como seguían apuntando a su categoría, el borrado de categorías
     fallaba con `violates RESTRICT setting of foreign key`. El nombre es lo
     único estable entre las dos. */
  const names = SEED_PLACES.map((p) => p.name);
  const categorySlugs = CATEGORY_ROWS.map((c) => c.slug);

  // Los lugares primero: `places.category_id` es `onDelete: restrict`, así que
  // borrar la categoría antes falla si todavía le quedan negocios colgando.
  await db.delete(schema.places).where(inArray(schema.places.name, names));
  await db.delete(schema.categories).where(inArray(schema.categories.slug, categorySlugs));

  console.log("📁 Inserting categories...");
  /* Un `INSERT` por tabla y no un bucle de 43. Cada viaje de ida y vuelta es
     otra ocasión de que se corte el enlace a mitad de la siembra y haya que
     empezar de cero — ya pasó dos veces, la segunda en la fila 1 del bucle. */
  await db.insert(schema.categories).values(CATEGORY_ROWS);

  console.log("📍 Inserting places...");
  const orphans: string[] = [];
  const placeRows = SEED_PLACES.flatMap((p) => {
    const category = CATEGORY_ROWS.find((c) => c.name === p.category);
    if (!category) {
      orphans.push(`${p.name} (${p.category})`);
      return [];
    }
    return [
      {
        id: p.id,
        name: p.name,
        slug: p.id,
        description: p.description,
        categoryId: category.id,
        lat: p.lat,
        lng: p.lng,
        address: p.address,
        city: p.city,
        province: p.province,
        neighborhood: p.barrio,
        schedule: p.schedule,
        paymentMethods: p.payments,
        currencies: p.currency,
        vibe: p.vibe,
        menu: p.menu,
        offerText: p.offer?.text ?? null,
        offerExpiry: p.offer?.expiry ?? null,
        rating: p.rating,
        priceLabel: p.priceLabel,
        aiTags: p.aiTags,
        status: p.status,
        isBoosted: p.isBoosted,
        boostExpiresAt: p.boostExpiresAt,
        isActive: true,
      },
    ];
  });
  await db.insert(schema.places).values(placeRows);
  if (orphans.length > 0) {
    // Sin categoría no hay `category_id`, que es `notNull`: esos negocios se
    // quedan fuera. Es un error de datos, no un fallo, y hay que verlo.
    console.warn(`   ⚠️  ${orphans.length} sin categoría conocida: ${orphans.join(", ")}`);
  }

  /* Sin esto la búsqueda devuelve cero filas siempre: `semanticGeoSearch`
     filtra por `embedding IS NOT NULL` y el INSERT de arriba no lo pone.
     `regenerateAllEmbeddings` ya sabe hacer el trabajo (texto, lote, reintento
     por fila), así que se reutiliza en vez de embeber aquí a mano. */
  console.log("🧠 Generating embeddings...");
  const { regenerated, failed } = await regenerateAllEmbeddings({
    onProgress: (done, total) => console.log(`   ${done}/${total}`),
  });
  console.log(`   ${regenerated} embeddings generados, ${failed.length} fallidos`);

  console.log("✅ Seed complete!");
}

seed()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .then(() => process.exit(0));
