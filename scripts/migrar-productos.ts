/**
 * Copia la carta de cada negocio (`places.menu`) a la tabla `productos`.
 *
 *   npx tsx --env-file=.env scripts/migrar-productos.ts            # modo prueba
 *   npx tsx --env-file=.env scripts/migrar-productos.ts --aplicar  # escribe
 *
 * **En modo prueba no escribe nada**: lee y imprime el informe —productos por
 * negocio, ids reasignados, referencias remapeadas, precios sin número y ofertas
 * huérfanas—. Solo con `--aplicar`:
 *
 * 1. escribe los ids nuevos dentro de `places.menu` (solo en los negocios con
 *    ids posicionales o repetidos), con una guarda: si la carta cambió desde que
 *    se leyó, ese negocio se salta y hay que volver a correr el script;
 * 2. remapea `ofertas.producto_id` y `novedades.producto_id` de ese negocio;
 * 3. hace upsert de cada producto en `productos` y borra de la tabla los que ya
 *    no están en la carta.
 *
 * Los pasos 2 y 3 van en una sola transacción por negocio.
 *
 * **Idempotente.** Tras la primera pasada `places.menu` ya no tiene ids
 * posicionales, así que la segunda no reasigna nada y el upsert escribe lo
 * mismo. `version` solo sube si el contenido de la fila cambió de verdad.
 *
 * **No borra `places.menu`**, ni la vacía: mientras dure la transición sigue
 * siendo la fuente de la que se copia.
 */
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { planMigracion, type FilaProducto } from "@/lib/productos";
import type { UserPlaceMenuItem } from "@/lib/places-store";

const APLICAR = process.argv.includes("--aplicar");
const { places, productos, ofertas, novedades } = schema;

/** Las columnas de contenido: si alguna cambia, sube la versión. */
const CONTENIDO = [
  "orden",
  "categoria",
  "nombre",
  "descripcion",
  "imagen",
  "tag",
  "precio_texto",
  "precio",
  "moneda",
  "tipo_precio",
  "disponibilidad",
  "agotado_hasta",
  "oculto",
  "destacado",
  "stock",
  "duracion_min",
  "external_id",
  "importacion_id",
] as const;

const tupla = (prefijo: string) =>
  CONTENIDO.map((col) => `${prefijo}."${col}"`).join(", ");
const CAMBIO = sql.raw(
  `(${tupla('"productos"')}) is distinct from (${tupla("excluded")})`,
);

/** `excluded."columna"`: el valor que traía el insert que chocó. */
const ex = (columna: string) => sql.raw(`excluded."${columna}"`);

function upsert(filas: FilaProducto[]) {
  return db
    .insert(productos)
    .values(filas)
    .onConflictDoUpdate({
      target: productos.id,
      set: {
        placeId: ex("place_id"),
        orden: ex("orden"),
        categoria: ex("categoria"),
        nombre: ex("nombre"),
        descripcion: ex("descripcion"),
        imagen: ex("imagen"),
        tag: ex("tag"),
        precioTexto: ex("precio_texto"),
        precio: ex("precio"),
        moneda: ex("moneda"),
        tipoPrecio: ex("tipo_precio"),
        disponibilidad: ex("disponibilidad"),
        agotadoHasta: ex("agotado_hasta"),
        oculto: ex("oculto"),
        destacado: ex("destacado"),
        stock: ex("stock"),
        duracionMin: ex("duracion_min"),
        externalId: ex("external_id"),
        importacionId: ex("importacion_id"),
        /* La versión y la fecha solo se mueven si el contenido cambió: correr
           el script dos veces no debe parecer, en la fase C, un cambio ajeno. */
        version: sql`case when ${CAMBIO} then ${productos.version} + 1 else ${productos.version} end`,
        actualizadoEn: sql`case when ${CAMBIO} then now() else ${productos.actualizadoEn} end`,
      },
    });
}

async function main() {
  console.log(APLICAR ? "== MODO APLICAR: se escribe ==\n" : "== MODO PRUEBA: no se escribe nada ==\n");

  const negocios = await db
    .select({ id: places.id, name: places.name, menu: places.menu })
    .from(places);
  const refsOfertas = await db
    .select({ id: ofertas.id, negocioId: ofertas.negocioId, productoId: ofertas.productoId })
    .from(ofertas);
  const refsNovedades = await db
    .select({ id: novedades.id, negocioId: novedades.negocioId, productoId: novedades.productoId })
    .from(novedades);

  const plan = planMigracion(
    negocios.map((n) => ({ ...n, menu: (n.menu ?? null) as UserPlaceMenuItem[] | null })),
    refsOfertas,
    refsNovedades,
    generateId,
  );

  /* ── Informe ──────────────────────────────────────────────────────── */
  const total = plan.negocios.reduce((suma, n) => suma + n.filas.length, 0);
  console.log(`Negocios: ${plan.negocios.length} · productos: ${total}\n`);

  console.log("Productos por negocio:");
  for (const n of [...plan.negocios].sort((a, b) => b.filas.length - a.filas.length)) {
    console.log(`  ${String(n.filas.length).padStart(4)}  ${n.nombre} (${n.placeId})`);
  }

  const reasignados = plan.negocios.flatMap((n) =>
    n.reasignados.map((r) => ({ ...r, negocio: n.nombre })),
  );
  console.log(`\nIds reasignados: ${reasignados.length}`);
  for (const r of reasignados) {
    console.log(`  ${r.negocio} · «${r.nombre}»: ${r.antes} → ${r.despues} (${r.motivo})`);
  }

  console.log(`\nOfertas remapeadas: ${plan.remapeoOfertas.length}`);
  for (const r of plan.remapeoOfertas) console.log(`  oferta ${r.id}: ${r.de} → ${r.a}`);
  console.log(`Novedades remapeadas: ${plan.remapeoNovedades.length}`);
  for (const r of plan.remapeoNovedades) console.log(`  novedad ${r.id}: ${r.de} → ${r.a}`);

  console.log(`\nProductos sin precio numérico: ${plan.sinPrecio.length}`);
  for (const s of plan.sinPrecio) {
    console.log(`  ${s.negocio} · «${s.nombre}» (${s.id}): ${JSON.stringify(s.texto)} → ${s.tipo}`);
  }

  console.log(`\nOfertas huérfanas (no apuntan a ningún producto): ${plan.ofertasHuerfanas.length}`);
  for (const o of plan.ofertasHuerfanas) {
    console.log(`  oferta ${o.id} · negocio ${o.negocioId} · producto ${o.productoId}`);
  }

  if (!APLICAR) {
    console.log("\nNada escrito. Para aplicar: --aplicar");
    return;
  }

  /* ── Escritura ────────────────────────────────────────────────────── */
  const originales = new Map(negocios.map((n) => [n.id, n.menu]));
  const ofertaDeNegocio = new Map(refsOfertas.map((o) => [o.id, o.negocioId]));
  const novedadDeNegocio = new Map(refsNovedades.map((n) => [n.id, n.negocioId]));
  const saltados: string[] = [];

  for (const n of plan.negocios) {
    if (n.cambiaMenu) {
      /* La guarda: solo si la carta sigue siendo la que se leyó. Si el dueño
         guardó entre medias, se salta y la próxima pasada lo recoge. */
      const escrito = await db
        .update(places)
        .set({ menu: n.menu })
        .where(
          and(
            eq(places.id, n.placeId),
            sql`${places.menu} = ${JSON.stringify(originales.get(n.placeId) ?? null)}::jsonb`,
          ),
        )
        .returning({ id: places.id });
      if (escrito.length === 0) {
        saltados.push(n.nombre);
        continue;
      }
    }

    const ids = n.filas.map((f) => f.id);
    const consultas = [
      ...plan.remapeoOfertas
        .filter((r) => ofertaDeNegocio.get(r.id) === n.placeId)
        .map((r) =>
          db
            .update(ofertas)
            .set({ productoId: r.a })
            .where(and(eq(ofertas.id, r.id), eq(ofertas.productoId, r.de))),
        ),
      ...plan.remapeoNovedades
        .filter((r) => novedadDeNegocio.get(r.id) === n.placeId)
        .map((r) =>
          db
            .update(novedades)
            .set({ productoId: r.a })
            .where(and(eq(novedades.id, r.id), eq(novedades.productoId, r.de))),
        ),
      ...(n.filas.length > 0 ? [upsert(n.filas)] : []),
      db
        .delete(productos)
        .where(
          ids.length > 0
            ? and(eq(productos.placeId, n.placeId), notInArray(productos.id, ids))
            : eq(productos.placeId, n.placeId),
        ),
    ];

    await db.batch(consultas as unknown as Parameters<typeof db.batch>[0]);
  }

  console.log(`\nAplicado en ${plan.negocios.length - saltados.length} negocios.`);
  if (saltados.length > 0) {
    console.log(`Saltados porque su carta cambió mientras corría (vuelve a correr): ${saltados.join(", ")}`);
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
