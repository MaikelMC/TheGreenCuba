/**
 * Vuelta atrás de la fase C: reconstruye `places.menu` desde la tabla `productos`.
 *
 *   npx tsx --env-file=.env scripts/productos-a-menu.ts            # prueba
 *   npx tsx --env-file=.env scripts/productos-a-menu.ts --aplicar  # escribe
 *
 * Desde la fase C la carta se escribe en la tabla y `places.menu` queda
 * congelado. Si hay que revertir la fase C, el código anterior vuelve a escribir
 * y leer el jsonb, que tendría la carta del día del despliegue. Esto lo pone al
 * día con la tabla antes de revertir, sin perder nada: `precio_texto` es el
 * texto original del dueño y `itemDeFila` devuelve el mismo `UserPlaceMenuItem`
 * que había.
 *
 * En modo prueba solo dice cuántos productos tendría cada carta y cuántos
 * cambian respecto a lo que hay en `places.menu`.
 */
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { itemDeFila } from "@/lib/productos";

const APLICAR = process.argv.includes("--aplicar");

async function main() {
  console.log(APLICAR ? "== MODO APLICAR: se escribe ==\n" : "== MODO PRUEBA: no se escribe nada ==\n");

  const negocios = await db
    .select({ id: schema.places.id, name: schema.places.name, menu: schema.places.menu })
    .from(schema.places);
  const filas = await db
    .select()
    .from(schema.productos)
    .orderBy(asc(schema.productos.placeId), asc(schema.productos.orden));

  const cartas = new Map<string, ReturnType<typeof itemDeFila>[]>();
  for (const fila of filas) {
    /* Sin la versión: el jsonb no la tenía y el código anterior no la conoce. */
    const { version: _version, ...item } = itemDeFila(fila);
    const lista = cartas.get(fila.placeId) ?? [];
    lista.push(item);
    cartas.set(fila.placeId, lista);
  }

  let cambian = 0;
  for (const negocio of negocios) {
    const carta = cartas.get(negocio.id) ?? [];
    const igual = JSON.stringify(carta) === JSON.stringify(negocio.menu ?? []);
    if (!igual) cambian += 1;
    console.log(
      `  ${String(carta.length).padStart(4)}  ${negocio.name}${igual ? "" : `  (cambia: ${negocio.menu?.length ?? 0} → ${carta.length})`}`,
    );
    if (APLICAR && !igual) {
      await db
        .update(schema.places)
        .set({ menu: carta })
        .where(eq(schema.places.id, negocio.id));
    }
  }

  console.log(`\n${cambian} carta(s) distinta(s) de places.menu.`);
  console.log(APLICAR ? "places.menu reconstruido desde la tabla." : "Nada escrito. Para aplicar: --aplicar");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
