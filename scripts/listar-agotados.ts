/**
 * Lista todos los productos con disponibilidad: "agotado" en producción.
 *
 * Solo lectura. No escribe nada.
 *
 * Uso:
 *   npx tsx --env-file-if-exists=.env scripts/listar-agotados.ts
 */

import { db, schema } from "@/lib/db";
import { isNotNull } from "drizzle-orm";
import type { UserPlaceMenuItem } from "@/lib/places-store";

async function main() {
  const rows = await db
    .select({ id: schema.places.id, name: schema.places.name, menu: schema.places.menu })
    .from(schema.places);

  let totalNegocios = 0;
  let totalProductos = 0;

  for (const row of rows) {
    const menu = (row.menu ?? []) as UserPlaceMenuItem[];
    const agotados = menu.filter((item) => item.disponibilidad === "agotado");
    if (agotados.length === 0) continue;

    totalNegocios += 1;
    totalProductos += agotados.length;

    console.log(`\n📍 ${row.name} (${row.id})`);
    for (const item of agotados) {
      const hasta = item.agotadoHasta
        ? ` — hasta ${new Date(item.agotadoHasta).toLocaleString("es-CU")}`
        : " — sin fecha de vuelta";
      console.log(`   · ${item.name}${hasta}`);
    }
  }

  console.log(
    `\n${totalProductos} productos agotados en ${totalNegocios} negocios de ${rows.length} totales.`,
  );
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
