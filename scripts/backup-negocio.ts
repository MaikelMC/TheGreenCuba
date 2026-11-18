/**
 * Copia de seguridad local de un negocio: su ficha y su carta.
 *
 *   npx tsx --env-file=.env scripts/backup-negocio.ts <placeId>
 *
 * Solo lee. Escribe un JSON en `backups/negocios/` (fuera de git) con:
 *
 * - `places`: la fila del negocio entera, menos `embedding` (es un vector de la
 *   búsqueda, pesa y se regenera; no es un dato del negocio);
 * - `productos`: la carta en la tabla nueva;
 * - `place_images`, `place_hours` y `ofertas` del negocio.
 *
 * Se restaura con `scripts/restaurar-negocio.ts`, que por defecto toma la copia
 * más reciente de ese negocio.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const DIRECTORIO = join(process.cwd(), "backups", "negocios");

async function main() {
  const placeId = process.argv[2]?.trim();
  if (!placeId) {
    console.error("Uso: scripts/backup-negocio.ts <placeId>");
    process.exit(1);
  }

  const [lugar] = await db
    .select()
    .from(schema.places)
    .where(eq(schema.places.id, placeId))
    .limit(1);
  if (!lugar) {
    console.error(`No existe el negocio ${placeId}.`);
    process.exit(1);
  }
  const { embedding: _embedding, ...ficha } = lugar;

  const [productos, imagenes, horarios, ofertas] = await Promise.all([
    db.select().from(schema.productos).where(eq(schema.productos.placeId, placeId)),
    db.select().from(schema.placeImages).where(eq(schema.placeImages.placeId, placeId)),
    db.select().from(schema.placeHours).where(eq(schema.placeHours.placeId, placeId)),
    db.select().from(schema.ofertas).where(eq(schema.ofertas.negocioId, placeId)),
  ]);

  const copia = {
    formato: 1,
    creadoEn: new Date().toISOString(),
    placeId,
    nombre: ficha.name,
    tablas: {
      places: [ficha],
      productos: [...productos].sort((a, b) => a.orden - b.orden),
      place_images: imagenes,
      place_hours: horarios,
      ofertas,
    },
  };

  mkdirSync(DIRECTORIO, { recursive: true });
  const sello = copia.creadoEn.replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  const archivo = join(DIRECTORIO, `${placeId}-${sello}.json`);
  writeFileSync(archivo, JSON.stringify(copia, null, 2));

  console.log(`Copia de «${ficha.name}» guardada en ${archivo}`);
  console.log(
    `  ficha: 1 · productos: ${productos.length} · carta en places.menu: ${ficha.menu?.length ?? 0}` +
      ` · fotos: ${imagenes.length} · horarios: ${horarios.length} · ofertas: ${ofertas.length}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
