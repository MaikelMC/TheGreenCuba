/**
 * Marca 35 productos de Yoyi Sabor como disponibilidad: "agotado".
 *
 * Lee el menú actual, aplica el cambio SOLO a los productos de la lista
 * y guarda. Los demás 50 productos no se tocan.
 *
 * Reversible: el dueño puede desmarcarlos desde el panel (Catálogo → ojo).
 *
 * Uso:
 *   npx tsx --env-file-if-exists=.env scripts/marcar-agotados-yoyi.ts
 *   npx tsx --env-file-if-exists=.env scripts/marcar-agotados-yoyi.ts --apply
 */

import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { UserPlaceMenuItem } from "@/lib/places-store";

const YOYI_ID = "E4gQYp3LOVI-";

/** Nombres exactos en la DB de los 35 productos a marcar. */
const AGOTADOS = new Set([
  "Tacos de Camarones",
  "Tacos Ahumados",
  "Agregado de Ahumado",
  "Tacos de Atún",
  "Tacos de Pollo",
  "Quesadilla de Atún (Queso Blanco)",
  "Quesadilla de Ahumado (Queso Blanco)",
  "Quesadilla de Camarón (Queso Blanco)",
  "Quesadilla de Atún (Queso Gouda)",
  "Empanada de Ahumado y Queso (Queso Blanco)",
  "Empanada de Pollo",
  "Empanada de Lomo Ahumado",
  "Empanada de Atún y Queso (Queso Blanco)",
  "Empanada de Camarón",
  "Empanada de Vegetales",
  "Empanada de Picadillo",
  "Empanada de Atún y Queso (Queso Gouda)",
  "Empanada Caprese (Queso Gouda)",
  "Tequeños Ahumados (Queso Blanco)",
  "Mixtos de Salchicha (Queso Blanco)",
  "Tequeños Ahumados (Queso Gouda)",
  "Mixtos de Salchicha (Queso Gouda)",
  "Burrito de Camarón (Queso Blanco)",
  "Burrito de Ahumado (Queso Blanco)",
  "Burrito de Pollo (Queso Blanco)",
  "Burrito de Atún (Queso Blanco)",
  "Burrito de Camarón (Queso Gouda)",
  "Burrito de Ahumado (Queso Gouda)",
  "Burrito de Pollo (Queso Gouda)",
  "Burrito de Atún (Queso Gouda)",
  "Agregado de Pollo",
  "Néctar de Pera 330 ml",
  "Refresco 1.5 L",
  "Quesadilla de Ahumado (Queso Gouda)",
  "Quesadilla de Camarón (Queso Gouda)",
]);

const aplicar = process.argv.includes("--apply");

async function main() {
  const [row] = await db
    .select({ menu: schema.places.menu })
    .from(schema.places)
    .where(eq(schema.places.id, YOYI_ID))
    .limit(1);

  if (!row) {
    console.error("❌ Negocio no encontrado");
    process.exit(1);
  }

  const menu = (row.menu ?? []) as UserPlaceMenuItem[];
  let marcados = 0;
  let noEncontrados = 0;

  const nuevoMenu = menu.map((item) => {
    if (!AGOTADOS.has(item.name)) return item;
    marcados += 1;
    return { ...item, disponibilidad: "agotado" as const, agotadoHasta: null };
  });

  // Verificar cuáles no se encontraron
  const encontrados = new Set(menu.map((i) => i.name));
  for (const nombre of AGOTADOS) {
    if (!encontrados.has(nombre)) {
      console.warn(`⚠️  No encontrado en el menú: "${nombre}"`);
      noEncontrados += 1;
    }
  }

  console.log(`\n${aplicar ? "✍️  Aplicando" : "ℹ️  Simulación (sin --apply)"}`);
  console.log(`   Productos a marcar como agotado: ${marcados}`);
  console.log(`   No encontrados: ${noEncontrados}`);
  console.log(`   Productos sin cambio: ${menu.length - marcados}`);

  if (!aplicar) {
    console.log("\nCorre con --apply para escribir en la DB.");
    return;
  }

  await db
    .update(schema.places)
    .set({ menu: nuevoMenu })
    .where(eq(schema.places.id, YOYI_ID));

  console.log("\n✅ Menú actualizado en la DB.");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
