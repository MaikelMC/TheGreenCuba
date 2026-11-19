/**
 * Las ofertas que apuntan a un producto que no existe, antes de la clave foránea.
 *
 *   npx tsx --env-file=.env scripts/ofertas-huerfanas.ts            # lista
 *   npx tsx --env-file=.env scripts/ofertas-huerfanas.ts --aplicar  # las borra
 *
 * La migración que hace de `ofertas.producto_id` una clave foránea a
 * `productos.id` falla si queda una sola oferta huérfana. Este es el paso
 * aparte (decisión D3): primero se listan, se revisan, y solo con `--aplicar`
 * se borran. Una oferta huérfana ya no se enseña en ningún sitio —no tiene
 * producto con el que pintarse—, así que borrarla no cambia nada a la vista.
 */
import { inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const APLICAR = process.argv.includes("--aplicar");

async function main() {
  const huerfanas = await db
    .select({
      id: schema.ofertas.id,
      negocioId: schema.ofertas.negocioId,
      productoId: schema.ofertas.productoId,
      titulo: schema.ofertas.titulo,
      termina: schema.ofertas.termina,
    })
    .from(schema.ofertas)
    .where(
      sql`not exists (select 1 from ${schema.productos} p where p.id = ${schema.ofertas.productoId} and p.place_id = ${schema.ofertas.negocioId})`,
    );

  console.log(`Ofertas huérfanas: ${huerfanas.length}`);
  for (const o of huerfanas) {
    console.log(`  ${o.id} · negocio ${o.negocioId} · producto ${o.productoId} · «${o.titulo}» · termina ${o.termina.toISOString()}`);
  }

  if (huerfanas.length === 0) {
    console.log("Nada que borrar: se puede aplicar la migración de la clave foránea.");
    return;
  }
  if (!APLICAR) {
    console.log("\nNada borrado. Para borrarlas: --aplicar");
    return;
  }
  await db.delete(schema.ofertas).where(inArray(schema.ofertas.id, huerfanas.map((o) => o.id)));
  console.log(`\nBorradas ${huerfanas.length}. Ya se puede aplicar la migración de la clave foránea.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
