import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { UserPlaceMenuItem } from "@/lib/places-store";

const YOYI_ID = "E4gQYp3LOVI-";

async function main() {
  const [row] = await db
    .select({ menu: schema.places.menu })
    .from(schema.places)
    .where(eq(schema.places.id, YOYI_ID))
    .limit(1);

  const menu = (row?.menu ?? []) as UserPlaceMenuItem[];
  console.log(`${menu.length} productos de Yoyi Sabor:\n`);
  menu.forEach((item, i) => {
    const disp = item.disponibilidad ? ` [${item.disponibilidad}]` : "";
    console.log(`${String(i + 1).padStart(2, " ")}. ${item.name}${disp}`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
