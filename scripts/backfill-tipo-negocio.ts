import { eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { TipoNegocio } from "@/lib/ficha/tipos";

/**
 * Rellena `places.tipo_negocio` a partir de la categoría del negocio.
 *
 * Solo asigna lo inequívoco y solo donde el tipo sigue vacío: es idempotente y
 * no toca una ficha que ya tenga tipo elegido. Los negocios cuya categoría no
 * está en la tabla —discoteca, playa, cultura, hospedaje…— se quedan en `null`
 * a propósito: `null` es un estado válido (la ficha usa el esqueleto común) y
 * adivinar un tipo escribiría una afirmación que el negocio no hizo. La lista
 * de los que quedan se imprime para revisarla en `/admin/negocios`.
 *
 * Uso:
 *   npx tsx --env-file-if-exists=.env scripts/backfill-tipo-negocio.ts
 *   npx tsx --env-file-if-exists=.env scripts/backfill-tipo-negocio.ts --apply
 *
 * Sin `--apply` solo cuenta y enseña lo que haría.
 */

const TIPO_POR_CATEGORIA: Record<string, TipoNegocio> = {
  restaurante: "cafeteria_restaurante",
  cafeteria: "cafeteria_restaurante",
  bar: "cafeteria_restaurante",
  mercado: "tienda_mipyme",
  tienda: "tienda_mipyme",
  servicio: "servicios",
  "comida-a-domicilio": "comida_domicilio",
};

const aplicar = process.argv.includes("--apply");

async function main() {
  const rows = await db
    .select({
      id: schema.places.id,
      name: schema.places.name,
      slug: schema.categories.slug,
    })
    .from(schema.places)
    .innerJoin(schema.categories, eq(schema.places.categoryId, schema.categories.id))
    .where(isNull(schema.places.tipoNegocio));

  const porTipo = new Map<TipoNegocio, string[]>();
  const sinTipo = new Set<string>();

  for (const row of rows) {
    const tipo = TIPO_POR_CATEGORIA[row.slug];
    if (!tipo) {
      sinTipo.add(row.slug);
      continue;
    }
    const ids = porTipo.get(tipo) ?? [];
    ids.push(row.id);
    porTipo.set(tipo, ids);
  }

  for (const [tipo, ids] of porTipo) {
    console.log(`${aplicar ? "✍️ " : "·  "} ${tipo}: ${ids.length}`);
    if (!aplicar) continue;
    await db
      .update(schema.places)
      .set({ tipoNegocio: tipo })
      .where(inArray(schema.places.id, ids));
  }

  const asignados = [...porTipo.values()].reduce((n, ids) => n + ids.length, 0);
  console.log(
    `${aplicar ? "✅" : "ℹ️ "} ${asignados} negocios ${aplicar ? "actualizados" : "por actualizar"}.`,
  );

  if (sinTipo.size > 0) {
    console.log(`\nSin tipo (revisar a mano): categorías ${[...sinTipo].join(", ")}.`);
    for (const row of rows) {
      if (!TIPO_POR_CATEGORIA[row.slug]) console.log(`   · ${row.name}`);
    }
  }
}

main().catch((error) => {
  console.error("❌", error);
  process.exit(1);
});
