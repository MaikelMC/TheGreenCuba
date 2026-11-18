/**
 * Restaura un negocio desde una copia de `scripts/backup-negocio.ts`.
 *
 *   npx tsx --env-file=.env scripts/restaurar-negocio.ts <placeId | archivo.json>            # prueba
 *   npx tsx --env-file=.env scripts/restaurar-negocio.ts <placeId | archivo.json> --aplicar  # escribe
 *
 * Con un `placeId` usa la copia más reciente de ese negocio en
 * `backups/negocios/`. **En modo prueba no escribe nada**: dice qué copia usaría
 * y cuánto cambiaría respecto a lo que hay ahora en la base.
 *
 * Con `--aplicar`, en una sola transacción:
 *
 * - la ficha (`places`) vuelve a los valores de la copia —salvo `embedding`,
 *   que la copia no lleva y no se toca—; si el negocio no existe, se crea;
 * - `productos`, `place_images`, `place_hours` y `ofertas` del negocio quedan
 *   **exactamente** como en la copia: se borra lo que hay y se vuelve a
 *   insertar lo copiado, con sus mismos ids.
 *
 * Antes de escribir hace una copia de lo que hay ahora (`backup-negocio.ts`),
 * así que una restauración equivocada también tiene vuelta atrás.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { eq, getTableColumns, type Table } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const DIRECTORIO = join(process.cwd(), "backups", "negocios");
const APLICAR = process.argv.includes("--aplicar");

interface Copia {
  formato: number;
  creadoEn: string;
  placeId: string;
  nombre: string;
  tablas: Record<
    "places" | "productos" | "place_images" | "place_hours" | "ofertas",
    Record<string, unknown>[]
  >;
}

function elegirArchivo(argumento: string): string {
  if (argumento.endsWith(".json")) return argumento;
  if (!existsSync(DIRECTORIO)) throw new Error(`No hay copias en ${DIRECTORIO}`);
  const candidatos = readdirSync(DIRECTORIO)
    .filter((nombre) => nombre.startsWith(`${argumento}-`) && nombre.endsWith(".json"))
    .sort();
  const ultimo = candidatos.at(-1);
  if (!ultimo) throw new Error(`No hay copias del negocio ${argumento} en ${DIRECTORIO}`);
  return join(DIRECTORIO, ultimo);
}

/**
 * Las fechas viajan como texto en el JSON; Drizzle quiere `Date` en las columnas
 * `timestamp`. Se convierten solo esas, mirando el tipo de cada columna.
 */
function revivir(tabla: Table, filas: Record<string, unknown>[]) {
  const fechas = Object.entries(getTableColumns(tabla))
    .filter(([, columna]) => columna.columnType === "PgTimestamp")
    .map(([clave]) => clave);
  return filas.map((fila) => {
    const copia = { ...fila };
    for (const clave of fechas) {
      const valor = copia[clave];
      if (typeof valor === "string") copia[clave] = new Date(valor);
    }
    return copia;
  });
}

async function main() {
  const argumento = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!argumento) {
    console.error("Uso: scripts/restaurar-negocio.ts <placeId | archivo.json> [--aplicar]");
    process.exit(1);
  }

  const archivo = elegirArchivo(argumento);
  const copia = JSON.parse(readFileSync(archivo, "utf8")) as Copia;
  if (copia.formato !== 1) throw new Error(`Formato de copia desconocido: ${copia.formato}`);
  const { placeId, tablas } = copia;

  const [ahora] = await db
    .select({ id: schema.places.id })
    .from(schema.places)
    .where(eq(schema.places.id, placeId))
    .limit(1);
  const actuales = await db
    .select({ id: schema.productos.id })
    .from(schema.productos)
    .where(eq(schema.productos.placeId, placeId));

  console.log(`${APLICAR ? "== APLICAR ==" : "== PRUEBA: no se escribe nada =="}`);
  console.log(`Copia: ${archivo}`);
  console.log(`  «${copia.nombre}» (${placeId}), hecha el ${copia.creadoEn}`);
  console.log(
    `  En la copia: productos ${tablas.productos.length}, fotos ${tablas.place_images.length},` +
      ` horarios ${tablas.place_hours.length}, ofertas ${tablas.ofertas.length}`,
  );
  console.log(
    `  En la base ahora: ${ahora ? "el negocio existe" : "el negocio NO existe (se crearía)"},` +
      ` productos ${actuales.length}`,
  );

  if (!APLICAR) {
    console.log("\nNada escrito. Para restaurar: --aplicar");
    return;
  }

  if (ahora) {
    console.log("\nCopia previa de lo que hay ahora, por si hay que deshacer:");
    execFileSync(
      "npx",
      ["tsx", "--env-file=.env", "scripts/backup-negocio.ts", placeId],
      { stdio: "inherit", shell: process.platform === "win32" },
    );
  }

  const [ficha] = revivir(schema.places, tablas.places);
  if (!ficha) throw new Error("La copia no trae la ficha del negocio.");
  const { id: _id, ...campos } = ficha;

  const consultas = [
    db
      .insert(schema.places)
      .values(ficha as typeof schema.places.$inferInsert)
      .onConflictDoUpdate({ target: schema.places.id, set: campos }),
    /* Las ofertas antes que los productos: en la fase C tendrán FK a ellos. */
    db.delete(schema.ofertas).where(eq(schema.ofertas.negocioId, placeId)),
    db.delete(schema.productos).where(eq(schema.productos.placeId, placeId)),
    db.delete(schema.placeImages).where(eq(schema.placeImages.placeId, placeId)),
    db.delete(schema.placeHours).where(eq(schema.placeHours.placeId, placeId)),
    ...(tablas.productos.length
      ? [db.insert(schema.productos).values(revivir(schema.productos, tablas.productos) as never)]
      : []),
    ...(tablas.place_images.length
      ? [db.insert(schema.placeImages).values(revivir(schema.placeImages, tablas.place_images) as never)]
      : []),
    ...(tablas.place_hours.length
      ? [db.insert(schema.placeHours).values(revivir(schema.placeHours, tablas.place_hours) as never)]
      : []),
    ...(tablas.ofertas.length
      ? [db.insert(schema.ofertas).values(revivir(schema.ofertas, tablas.ofertas) as never)]
      : []),
  ];

  await db.batch(consultas as unknown as Parameters<typeof db.batch>[0]);
  console.log(`\nRestaurado «${copia.nombre}» desde ${archivo}.`);
  console.log("La carta pública está cacheada: el cambio se ve al caducar la caché o al guardar algo en el panel.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
