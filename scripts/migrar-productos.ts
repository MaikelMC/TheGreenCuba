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
 * Los pasos 2 y 3 van en una sola transacción por negocio. La escritura es
 * `sincronizarNegocio` (src/lib/productos-server.ts), la misma que usa el
 * reflejo de la fase B; antes de escribir comprueba que la carta sigue siendo
 * la que se leyó al empezar, en **todos** los negocios.
 *
 * **Idempotente.** Tras la primera pasada `places.menu` ya no tiene ids
 * posicionales, así que la segunda no reasigna nada y el upsert escribe lo
 * mismo. `version` solo sube si el contenido de la fila cambió de verdad.
 *
 * **No borra `places.menu`**, ni la vacía: mientras dure la transición sigue
 * siendo la fuente de la que se copia.
 */
import { db, schema } from "@/lib/db";
import { generateId } from "@/lib/utils";
import { planMigracion } from "@/lib/productos";
import { sincronizarNegocio } from "@/lib/productos-server";
import type { UserPlaceMenuItem } from "@/lib/places-store";

const APLICAR = process.argv.includes("--aplicar");
const { places, ofertas, novedades } = schema;

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

  /* ── Escritura ────────────────────────────────────────────────────
     Negocio a negocio, con la misma función que el reflejo de la fase B
     (`sincronizarNegocio`). La carta que se leyó al empezar viaja como
     `menuEsperado`: si el dueño guardó mientras el script corría, ese negocio
     se salta en vez de escribir una copia vieja encima del reflejo. Los ids
     nuevos se generan otra vez aquí, así que no coinciden con los de muestra
     del informe de arriba. */
  const saltados: string[] = [];
  let aplicados = 0;

  for (const negocio of negocios) {
    const resultado = await sincronizarNegocio(negocio.id, negocio.menu ?? null);
    if (!resultado.ok) {
      saltados.push(`${negocio.name} (${resultado.motivo})`);
      continue;
    }
    aplicados += 1;
    for (const r of resultado.plan.reasignados) {
      console.log(`  aplicado · ${negocio.name} · «${r.nombre}»: ${r.antes} → ${r.despues}`);
    }
  }

  console.log(`
Aplicado en ${aplicados} negocios.`);
  if (saltados.length > 0) {
    console.log(`Saltados (vuelve a correr el script): ${saltados.join(", ")}`);
    process.exitCode = 2;
  }
  console.log(
    "La caché del catálogo de producción no se invalida desde aquí: lo leído de la tabla puede tardar hasta que caduque.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
