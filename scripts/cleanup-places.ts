import { inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Segunda pasada de limpieza del catálogo: da de baja los RESTAURANTES de
 * Santiago de Cuba, incluidos los dos inactivos de prueba.
 *
 * Borrado por NOMBRE exacto —mismo criterio que `cleanup-places.ts`—: el nombre
 * es lo único estable entre filas de siembra (slug = id del catálogo) y filas
 * creadas desde el panel (ids generados).
 *
 * Las tablas hijas caen por `ON DELETE cascade`; nada ajeno a esta lista se toca.
 */

const NAMES_TO_DELETE = [
  "Primos Twice",
  "Restaurante Bendita Farándula",
  "Restaurante La Cabaña",
  "Alo Cubano",
  "St. Pauli Restaurant-Bar",
  "Terraza Padre Pico",
  "La Caribeña",
  "El Barracón",
  "Restaurante Aurora",
  "Zunzún",
  "Salón Tropical",
  // Inactivos de prueba
  "Probando negocio",
  "Neogocio Kynari",
];

async function main() {
  console.log(`🧹 Buscando ${NAMES_TO_DELETE.length} negocios por nombre...`);

  const found = await db
    .select({ id: schema.places.id, name: schema.places.name, isActive: schema.places.isActive })
    .from(schema.places)
    .where(inArray(schema.places.name, NAMES_TO_DELETE));

  const foundNames = found.map((f) => f.name);
  const missing = NAMES_TO_DELETE.filter((n) => !foundNames.includes(n));
  if (missing.length > 0) {
    console.warn(`   ⚠️  No encontrados (se omiten): ${missing.join(", ")}`);
  }

  if (found.length === 0) {
    console.log("Nada que borrar.");
    return;
  }

  for (const f of found) console.log(`   🗑  ${f.name} (${f.id})${f.isActive ? "" : " [inactivo]"}`);

  const deleted = await db
    .delete(schema.places)
    .where(inArray(schema.places.name, NAMES_TO_DELETE))
    .returning({ id: schema.places.id });

  console.log(`✅ ${deleted.length} negocios eliminados del catálogo.`);
}

main()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .then(() => process.exit(0));
