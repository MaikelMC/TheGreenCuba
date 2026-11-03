import { db, schema } from "@/lib/db";

async function main() {
  const rows = await db
    .select({ id: schema.places.id, name: schema.places.name, menu: schema.places.menu })
    .from(schema.places);

  console.log(`${rows.length} negocios:\n`);
  rows.forEach((r, i) => {
    console.log(`${i + 1}. "${r.name}" (${r.menu?.length ?? 0} productos) — ${r.id}`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
