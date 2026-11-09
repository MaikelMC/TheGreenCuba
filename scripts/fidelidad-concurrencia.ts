/**
 * Prueba de concurrencia del sello de un pedido.
 *
 * **No es un test del CI**: escribe en la base. Se corre a mano, contra una
 * **rama de desarrollo** de Neon, nunca contra producción:
 *
 *   CONFIRMO_DEV=1 npx tsx --env-file-if-exists=.env scripts/fidelidad-concurrencia.ts
 *
 * Hace lo que el panel hace al marcar entregado, pero diez veces a la vez sobre
 * el mismo pedido: llama a `sellarPedido`, que es la sentencia exacta por la
 * que pasa `PATCH /api/pedidos`. Después comprueba que queda **un solo sello
 * activo**, que la tarjeta subió una sola vez, y que un pedido cancelado y
 * vuelto a completar suma otra vez (un sello neto por pedido, no uno para
 * siempre).
 *
 * Deja la base como la encontró: borra la tarjeta de prueba (sus movimientos
 * caen en cascada) y el pedido.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientesFrecuentes, pedidos, places } from "@/lib/db/schema";
import { alCancelarPedido, sellarPedido } from "@/lib/fidelidad-server";
import { rows } from "@/lib/analytics/sql";
import { generateId } from "@/lib/utils";

const TELEFONO = "+5355500011";
const INTENTOS = 10;

function hostDe(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(no se pudo leer la URL)";
  }
}

async function selloActivo(pedidoId: string): Promise<number> {
  const filas = await rows<{ n: number }>(sql`
    SELECT count(*)::int AS n
    FROM movimientos_sellos
    WHERE pedido_id = ${pedidoId} AND tipo = 'sello' AND anulado = false
  `);
  return filas[0]?.n ?? 0;
}

async function sellosDe(placeId: string): Promise<number | null> {
  const [fila] = await db
    .select({ sellos: clientesFrecuentes.sellos })
    .from(clientesFrecuentes)
    .where(
      and(
        eq(clientesFrecuentes.placeId, placeId),
        eq(clientesFrecuentes.telefono, TELEFONO),
      ),
    )
    .limit(1);
  return fila?.sellos ?? null;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL.");
    process.exit(1);
  }

  if (process.env.CONFIRMO_DEV !== "1") {
    console.error(
      [
        "",
        "  Esta prueba ESCRIBE en la base.",
        "",
        `  Base: ${hostDe(url)}`,
        "",
        "  Si es una rama de desarrollo de Neon —nunca producción—, repite con:",
        "",
        "    CONFIRMO_DEV=1 npx tsx --env-file-if-exists=.env scripts/fidelidad-concurrencia.ts",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  const [place] = await db
    .select({ id: places.id, name: places.name })
    .from(places)
    .orderBy(places.createdAt)
    .limit(1);

  if (!place) {
    console.error("No hay ningún negocio en la base para la prueba.");
    process.exit(1);
  }

  const pedidoId = generateId();
  const codigo = `T${Date.now().toString(36).slice(-4).toUpperCase()}`;

  /* Se borra primero cualquier resto de una corrida anterior: si quedara la
     tarjeta, el recuento de sellos empezaría en un número que no es cero. */
  await db
    .delete(clientesFrecuentes)
    .where(
      and(
        eq(clientesFrecuentes.placeId, place.id),
        eq(clientesFrecuentes.telefono, TELEFONO),
      ),
    );

  await db.insert(pedidos).values({
    id: pedidoId,
    placeId: place.id,
    codigo,
    telefonoCliente: TELEFONO,
    lineas: [
      { id: "prueba", name: "Pedido de prueba", price: "10", currency: "USD", qty: 1 },
    ],
  });

  console.log(`Negocio: ${place.name} (${place.id})`);
  console.log(`Pedido de prueba: #${codigo} (${pedidoId})`);
  console.log(`Lanzando ${INTENTOS} sellados simultáneos…`);

  try {
    const resultados = await Promise.all(
      Array.from({ length: INTENTOS }, () =>
        sellarPedido(place.id, pedidoId, TELEFONO, null),
      ),
    );
    const sumados = resultados.filter((r) => r.sumado).length;
    const activos = await selloActivo(pedidoId);
    const sellos = await sellosDe(place.id);

    console.log(`  · respuestas «sumado»: ${sumados}`);
    console.log(`  · sellos activos del pedido: ${activos}`);
    console.log(`  · sellos de la tarjeta: ${sellos}`);

    if (activos !== 1 || sumados !== 1 || sellos !== 1) {
      throw new Error(
        `Se esperaba exactamente 1 sello (activos=${activos}, sumados=${sumados}, tarjeta=${sellos}).`,
      );
    }

    /* Cancelar y volver a completar: el sello del pedido se anula y vuelve a
       sumar. Es la regla D6 —un sello *neto* por pedido—, no un sello eterno. */
    const revertido = await alCancelarPedido(place.id, pedidoId, null);
    const trasReversion = await selloActivo(pedidoId);
    const sellosTrasReversion = await sellosDe(place.id);
    if (!revertido || trasReversion !== 0 || sellosTrasReversion !== 0) {
      throw new Error(
        `La reversión no cuadró (revertido=${revertido}, activos=${trasReversion}, tarjeta=${sellosTrasReversion}).`,
      );
    }

    const otraVez = await sellarPedido(place.id, pedidoId, TELEFONO, null);
    const activosOtraVez = await selloActivo(pedidoId);
    const sellosOtraVez = await sellosDe(place.id);
    if (!otraVez.sumado || activosOtraVez !== 1 || sellosOtraVez !== 1) {
      throw new Error(
        `El pedido no volvió a sumar tras la reversión (sumado=${otraVez.sumado}, activos=${activosOtraVez}, tarjeta=${sellosOtraVez}).`,
      );
    }

    console.log("  · cancelar y volver a completar: suma otra vez ✓");
    console.log("\nOK: un pedido nunca da más de un sello neto.");
  } finally {
    await db
      .delete(clientesFrecuentes)
      .where(
        and(
          eq(clientesFrecuentes.placeId, place.id),
          eq(clientesFrecuentes.telefono, TELEFONO),
        ),
      );
    await db.delete(pedidos).where(eq(pedidos.id, pedidoId));
  }
}

main().catch((error) => {
  console.error("\nFALLÓ:", error instanceof Error ? error.message : error);
  process.exit(1);
});
