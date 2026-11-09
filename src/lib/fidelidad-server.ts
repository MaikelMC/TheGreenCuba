/**
 * Servidor de la tarjeta de cliente frecuente.
 *
 * **Un solo punto suma sellos.** `alCompletarPedido` es la única función que
 * crea el movimiento «sello» de un pedido, y la llama la transición de estado
 * (hoy solo `PATCH /api/pedidos`). Si mañana Telegram u otra vía marcan
 * entregado, tienen que pasar por aquí igual.
 *
 * **Un pedido nunca da más de un sello neto.** El índice único parcial
 * `movimientos_sellos_pedido_activo_idx` deja un solo sello activo por pedido.
 * El `INSERT` del movimiento lleva `ON CONFLICT DO NOTHING` y el `UPDATE` de la
 * tarjeta depende de su `RETURNING`: si el movimiento no entró, la tarjeta no
 * se mueve. Dos peticiones simultáneas sobre el mismo pedido: una inserta, la
 * otra choca contra el índice y no suma. Si el pedido se cancela, el sello se
 * anula (`anulado = true`) y la reversión baja la tarjeta; si se vuelve a
 * completar, el índice ya no estorba y suma otra vez.
 *
 * Todo va en **una sola sentencia** por operación (CTE con `INSERT … RETURNING`
 * y un `UPDATE` que lo referencia), no en leer-calcular-escribir: con Neon HTTP
 * no hay transacciones interactivas, y esto da atomicidad sin ellas.
 */

import { randomBytes } from "node:crypto";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { rows } from "@/lib/analytics/sql";
import { db } from "@/lib/db";
import {
  clientesFrecuentes,
  movimientosSellos,
  pedidos,
  places,
  users,
} from "@/lib/db/schema";
import {
  aplicarCanje,
  cumpleCompraMinima,
  esFidelidadConfig,
  estadoTarjeta,
  type EstadoTarjeta,
  type FidelidadConfig,
} from "@/lib/fidelidad";
import type { Monto } from "@/lib/ficha/entrega";
import type { LineaPedido } from "@/lib/pedido";
import { totalDePedido } from "@/lib/pedido";
import { tieneFuncion } from "@/lib/plans-server";
import { enmascararTelefono, normalizarTelefono } from "@/lib/telefono";
import { generateId } from "@/lib/utils";

/* ── configuración ──────────────────────────────────────────────────────── */

/** La configuración guardada, o `null` si no hay o no valida. */
export async function configFidelidadDe(
  placeId: string,
): Promise<FidelidadConfig | null> {
  const [fila] = await db
    .select({ fidelidad: places.fidelidad })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);
  const config = fila?.fidelidad;
  return config && esFidelidadConfig(config) ? config : null;
}

export type GuardarConfigResult =
  | { success: true }
  | { success: false; code: "validacion" | "no_encontrado"; error: string };

/** Guarda la tarjeta. Solo desde su propia ruta: nadie más escribe la columna. */
export async function guardarConfigFidelidad(
  placeId: string,
  valor: unknown,
): Promise<GuardarConfigResult> {
  if (!esFidelidadConfig(valor)) {
    return {
      success: false,
      code: "validacion",
      error: "La tarjeta tiene datos inválidos.",
    };
  }

  const actualizada = await db
    .update(places)
    .set({ fidelidad: valor })
    .where(eq(places.id, placeId))
    .returning({ id: places.id });

  if (actualizada.length === 0) {
    return { success: false, code: "no_encontrado", error: "Negocio no encontrado." };
  }
  return { success: true };
}

/**
 * ¿Puede este negocio usar la tarjeta ahora mismo?
 *
 * Pide las dos funciones: sin pedidos guardados no hay nada que sellar, y el
 * candado lo explica en vez de dejar una tarjeta que no suma nunca.
 */
export async function fidelidadActiva(
  placeId: string,
): Promise<FidelidadConfig | null> {
  if (!(await tieneFuncion(placeId, "cliente_frecuente"))) return null;
  if (!(await tieneFuncion(placeId, "whatsapp_pedido"))) return null;
  const config = await configFidelidadDe(placeId);
  return config?.activo ? config : null;
}

/* ── tarjeta ────────────────────────────────────────────────────────────── */

export interface ClienteTarjeta {
  id: string;
  placeId: string;
  telefono: string;
  nombre: string | null;
  sellos: number;
  sellosTotales: number;
  ciclo: number;
  token: string;
  origen: "pedido" | "manual";
  creadoEn: Date;
  actualizadoEn: Date;
}

function aClienteTarjeta(fila: typeof clientesFrecuentes.$inferSelect): ClienteTarjeta {
  return {
    id: fila.id,
    placeId: fila.placeId,
    telefono: fila.telefono,
    nombre: fila.nombre,
    sellos: fila.sellos,
    sellosTotales: fila.sellosTotales,
    ciclo: fila.ciclo,
    token: fila.token,
    origen: fila.origen,
    creadoEn: fila.creadoEn,
    actualizadoEn: fila.actualizadoEn,
  };
}

/** Las metas ya canjeadas **en el ciclo actual**. */
async function canjeadasDe(clienteId: string, ciclo: number): Promise<number[]> {
  const filas = await db
    .select({ meta: movimientosSellos.metaIndice })
    .from(movimientosSellos)
    .where(
      and(
        eq(movimientosSellos.clienteId, clienteId),
        eq(movimientosSellos.tipo, "canje"),
        eq(movimientosSellos.ciclo, ciclo),
      ),
    );
  return filas
    .map((f) => f.meta)
    .filter((meta): meta is number => meta !== null && meta >= 0);
}

async function tarjetaDe(
  config: FidelidadConfig,
  cliente: ClienteTarjeta,
): Promise<EstadoTarjeta> {
  const canjeadas = await canjeadasDe(cliente.id, cliente.ciclo);
  return estadoTarjeta(config, cliente.sellos, cliente.ciclo, canjeadas);
}

async function clientePorId(
  placeId: string,
  clienteId: string,
): Promise<ClienteTarjeta | null> {
  const [fila] = await db
    .select()
    .from(clientesFrecuentes)
    .where(
      and(
        eq(clientesFrecuentes.id, clienteId),
        eq(clientesFrecuentes.placeId, placeId),
      ),
    )
    .limit(1);
  return fila ? aClienteTarjeta(fila) : null;
}

/** El cliente de un teléfono (ya normalizado), si existe. */
export async function clientePorTelefono(
  placeId: string,
  valorTelefono: string,
): Promise<ClienteTarjeta | null> {
  const telefono = normalizarTelefono(valorTelefono);
  if (!telefono) return null;
  const [fila] = await db
    .select()
    .from(clientesFrecuentes)
    .where(
      and(
        eq(clientesFrecuentes.placeId, placeId),
        eq(clientesFrecuentes.telefono, telefono),
      ),
    )
    .limit(1);
  return fila ? aClienteTarjeta(fila) : null;
}

/** Lo que el panel necesita de una tarjeta, sin exponer el teléfono entero. */
export interface ResumenTarjeta {
  clienteId: string;
  token: string;
  /** Completo: solo viaja a rutas autenticadas del negocio. */
  telefono: string;
  telefonoEnmascarado: string;
  nombre: string | null;
  sellos: number;
  ciclo: number;
  /** El total de casillas de la tarjeta: siempre la última meta. */
  metaSellos: number;
  /** La próxima meta que aún no se alcanzó (nombre del premio). */
  proximoPremio: string | null;
  /** Sellos que faltan para la próxima meta. */
  proximoFaltan: number | null;
  premio: string | null;
  /** Todas las metas alcanzadas y sin canjear en este ciclo. */
  premios: { indice: number; premio: string }[];
}

export function resumenDe(cliente: ClienteTarjeta, tarjeta: EstadoTarjeta): ResumenTarjeta {
  return {
    clienteId: cliente.id,
    token: cliente.token,
    telefono: cliente.telefono,
    telefonoEnmascarado:
      enmascararTelefono(cliente.telefono) ?? cliente.telefono,
    nombre: cliente.nombre,
    sellos: tarjeta.sellos,
    ciclo: tarjeta.ciclo,
    /** Siempre el total: la última meta. */
    metaSellos: tarjeta.metaFinal.sellos,
    proximoPremio: tarjeta.siguiente?.premio ?? null,
    proximoFaltan: tarjeta.siguiente?.faltan ?? null,
    premio: tarjeta.listas[0]?.premio ?? null,
    premios: tarjeta.metas.flatMap((meta, indice) =>
      meta.alcanzada && !meta.canjeada
        ? [{ indice, premio: meta.premio }]
        : [],
    ),
  };
}

/**
 * El estado de las tarjetas de una lista de teléfonos, en una sola consulta de
 * clientes más la de canjes. Lo usa la lista de pedidos para saber quién tiene
 * premio listo sin hacer una consulta por pedido.
 */
export async function resumenesPorTelefono(
  placeId: string,
  config: FidelidadConfig,
  telefonos: readonly string[],
): Promise<Map<string, ResumenTarjeta>> {
  const mapa = new Map<string, ResumenTarjeta>();
  const limpios = [
    ...new Set(
      telefonos
        .map((t) => normalizarTelefono(t))
        .filter((t): t is string => t !== null),
    ),
  ];
  if (limpios.length === 0) return mapa;

  const filas = await db
    .select()
    .from(clientesFrecuentes)
    .where(
      and(
        eq(clientesFrecuentes.placeId, placeId),
        inArray(clientesFrecuentes.telefono, limpios),
      ),
    );

  if (filas.length === 0) return mapa;

  const canjes = await db
    .select({
      clienteId: movimientosSellos.clienteId,
      ciclo: movimientosSellos.ciclo,
      meta: movimientosSellos.metaIndice,
    })
    .from(movimientosSellos)
    .where(
      and(
        eq(movimientosSellos.placeId, placeId),
        eq(movimientosSellos.tipo, "canje"),
        inArray(
          movimientosSellos.clienteId,
          filas.map((f) => f.id),
        ),
      ),
    );

  for (const fila of filas) {
    const cliente = aClienteTarjeta(fila);
    const canjeadas = canjes
      .filter((c) => c.clienteId === cliente.id && c.ciclo === cliente.ciclo)
      .map((c) => c.meta)
      .filter((meta): meta is number => meta !== null && meta >= 0);
    const tarjeta = estadoTarjeta(config, cliente.sellos, cliente.ciclo, canjeadas);
    mapa.set(cliente.telefono, resumenDe(cliente, tarjeta));
  }
  return mapa;
}

/* ── sumar sellos ───────────────────────────────────────────────────────── */

export type ResultadoSello =
  | {
      estado: "sumado";
      telefonoEnmascarado: string;
      /** El token del enlace público, para el «Avisar al cliente». */
      token: string;
      tarjeta: EstadoTarjeta;
    }
  | { estado: "sin_funcion" }
  | { estado: "inactiva" }
  | { estado: "sin_telefono" }
  | { estado: "sin_comprobar" }
  | {
      estado: "bajo_minimo";
      total: number;
      currency: string;
      minimo: Monto;
    }
  | { estado: "duplicado" }
  | { estado: "no_encontrado" };

function nuevoToken(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Suma el sello del pedido. Único camino.
 *
 * Devuelve el estado de la tarjeta para que el panel lo enseñe en el aviso.
 * Los motivos por los que no suma se devuelven en vez de callarse: el panel
 * distingue «no llegó a la compra mínima» de «no se pudo comprobar», que es lo
 * que decide si ofrecer «Dar sello a mano».
 */
export async function alCompletarPedido(
  placeId: string,
  pedidoId: string,
  usuarioId: string | null,
): Promise<ResultadoSello> {
  if (!(await tieneFuncion(placeId, "cliente_frecuente"))) {
    return { estado: "sin_funcion" };
  }
  if (!(await tieneFuncion(placeId, "whatsapp_pedido"))) {
    return { estado: "sin_funcion" };
  }

  const config = await configFidelidadDe(placeId);
  if (!config?.activo) return { estado: "inactiva" };

  const [pedido] = await db
    .select({
      id: pedidos.id,
      telefono: pedidos.telefonoCliente,
      lineas: pedidos.lineas,
      tasaUsada: pedidos.tasaUsada,
    })
    .from(pedidos)
    .where(and(eq(pedidos.id, pedidoId), eq(pedidos.placeId, placeId)))
    .limit(1);

  if (!pedido) return { estado: "no_encontrado" };
  if (!pedido.telefono) return { estado: "sin_telefono" };

  const telefono = normalizarTelefono(pedido.telefono);
  if (!telefono) return { estado: "sin_telefono" };

  const total = totalDePedido(pedido.lineas as LineaPedido[]);
  const cumple = cumpleCompraMinima(total, config.compraMinima, pedido.tasaUsada);
  if (cumple === null) return { estado: "sin_comprobar" };
  if (cumple === false && total && config.compraMinima) {
    return {
      estado: "bajo_minimo",
      total: total.total,
      currency: total.currency,
      minimo: config.compraMinima,
    };
  }

  const sello = await sellarPedido(placeId, pedidoId, telefono, usuarioId);
  if (!sello.sumado || !sello.clienteId) {
    /* O el pedido ya tenía su sello activo, o dos primeras peticiones del mismo
       teléfono chocaron: en ambos casos no se suma nada. */
    return { estado: "duplicado" };
  }

  const cliente = await clientePorId(placeId, sello.clienteId);
  if (!cliente) return { estado: "duplicado" };

  return {
    estado: "sumado",
    telefonoEnmascarado: enmascararTelefono(cliente.telefono) ?? cliente.telefono,
    token: cliente.token,
    tarjeta: await tarjetaDe(config, cliente),
  };
}

/**
 * El núcleo atómico del sello, sin comprobar plan ni configuración.
 *
 * Lo llama `alCompletarPedido` después de validar; existe aparte para que la
 * prueba de concurrencia pueda lanzar diez peticiones a la vez sobre el mismo
 * pedido contra una rama de desarrollo sin montar un negocio entero con plan.
 * **No lo llames desde una ruta**: comprueba el plan fuera.
 *
 * Una sola sentencia con CTE. `cli_new` crea el cliente con su primer sello; si
 * ya existía, `ON CONFLICT DO NOTHING` no devuelve nada y `cli` lo lee de la
 * tabla. `mov` intenta el sello y `upd` solo mueve la tarjeta si `mov` devolvió
 * fila: ahí está la garantía de que un conflicto no suma. El índice único
 * parcial sobre `pedido_id` (tipo «sello» y no anulado) decide quién gana entre
 * dos peticiones simultáneas.
 */
export async function sellarPedido(
  placeId: string,
  pedidoId: string,
  telefono: string,
  usuarioId: string | null,
): Promise<{ sumado: boolean; clienteId: string | null }> {
  const clienteId = generateId();
  const movimientoId = generateId();
  const token = nuevoToken();

  const resultado = await rows<{
    sellos: number;
    clienteId: string | null;
  }>(sql`
    WITH ped AS (
      SELECT p.id, p.place_id, p.telefono_cliente
      FROM pedidos p
      WHERE p.id = ${pedidoId} AND p.place_id = ${placeId}
    ),
    cli_new AS (
      INSERT INTO clientes_frecuentes
        (id, place_id, telefono, token, origen, sellos, sellos_totales, ciclo)
      SELECT ${clienteId}, ped.place_id, ${telefono}, ${token}, 'pedido', 1, 1, 1
      FROM ped
      ON CONFLICT (place_id, telefono) DO NOTHING
      RETURNING id, ciclo
    ),
    cli AS (
      SELECT id, ciclo FROM cli_new
      UNION ALL
      SELECT c.id, c.ciclo
      FROM clientes_frecuentes c, ped
      WHERE c.place_id = ped.place_id AND c.telefono = ${telefono}
      LIMIT 1
    ),
    mov AS (
      INSERT INTO movimientos_sellos
        (id, cliente_id, place_id, tipo, cantidad, pedido_id, ciclo, usuario_id)
      SELECT ${movimientoId}, cli.id, ${placeId}, 'sello', 1, ${pedidoId}, cli.ciclo,
             ${usuarioId}
      FROM cli, ped
      ON CONFLICT DO NOTHING
      RETURNING cliente_id
    ),
    upd AS (
      UPDATE clientes_frecuentes c
      SET sellos = c.sellos + 1,
          sellos_totales = c.sellos_totales + 1,
          actualizado_en = now()
      WHERE c.id IN (SELECT cliente_id FROM mov)
        AND c.id NOT IN (SELECT id FROM cli_new)
      RETURNING c.id
    )
    SELECT
      (SELECT count(*)::int FROM mov) AS "sellos",
      (SELECT id FROM cli) AS "clienteId"
  `);

  const fila = resultado[0];
  if (!fila?.clienteId || fila.sellos === 0) {
    return { sumado: false, clienteId: fila?.clienteId ?? null };
  }
  return { sumado: true, clienteId: fila.clienteId };
}

/**
 * Anula el sello del pedido y baja la tarjeta.
 *
 * Solo actúa si había un sello activo: el `UPDATE` de anulación devuelve la
 * fila y la reversión depende de ese `RETURNING`, así que cancelar dos veces
 * —o cancelar un pedido que nunca se completó— no resta de más. La tarjeta no
 * baja de cero.
 */
export async function alCancelarPedido(
  placeId: string,
  pedidoId: string,
  usuarioId: string | null,
): Promise<boolean> {
  const resultado = await rows<{ revertidos: number }>(sql`
    WITH anulado AS (
      UPDATE movimientos_sellos
      SET anulado = true
      WHERE pedido_id = ${pedidoId}
        AND place_id = ${placeId}
        AND tipo = 'sello'
        AND anulado = false
      RETURNING cliente_id, ciclo
    ),
    rev AS (
      INSERT INTO movimientos_sellos
        (id, cliente_id, place_id, tipo, cantidad, pedido_id, ciclo, usuario_id)
      SELECT ${generateId()}, anulado.cliente_id, ${placeId}, 'reversion', -1,
             ${pedidoId}, anulado.ciclo, ${usuarioId}
      FROM anulado
      RETURNING cliente_id
    ),
    upd AS (
      UPDATE clientes_frecuentes c
      SET sellos = GREATEST(0, c.sellos - 1),
          sellos_totales = GREATEST(0, c.sellos_totales - 1),
          actualizado_en = now()
      WHERE c.id IN (SELECT cliente_id FROM rev)
      RETURNING c.id
    )
    SELECT (SELECT count(*)::int FROM upd) AS "revertidos"
  `);
  return (resultado[0]?.revertidos ?? 0) > 0;
}

/* ── sello a mano ───────────────────────────────────────────────────────── */

/**
 * Sello sin pedido guardado: el del teléfono en el mostrador o el del cliente
 * que ya venía con su tarjeta impresa.
 *
 * Crea el cliente si no existe y deja el movimiento con `pedido_id` nulo. No
 * pasa por la compra mínima: lo da una persona que está viendo la venta.
 */
export async function sellarAMano(
  placeId: string,
  valorTelefono: string,
  usuarioId: string | null,
  nota: string | null = null,
): Promise<
  | { estado: "sumado"; tarjeta: EstadoTarjeta; cliente: ClienteTarjeta }
  | { estado: "telefono_invalido" }
  | { estado: "sin_funcion" }
  | { estado: "inactiva" }
> {
  if (!(await tieneFuncion(placeId, "cliente_frecuente"))) {
    return { estado: "sin_funcion" };
  }
  const config = await configFidelidadDe(placeId);
  if (!config?.activo) return { estado: "inactiva" };

  const telefono = normalizarTelefono(valorTelefono);
  if (!telefono) return { estado: "telefono_invalido" };

  const clienteId = generateId();
  const movimientoId = generateId();
  const token = nuevoToken();

  const resultado = await rows<{ clienteId: string | null }>(sql`
    WITH cli_new AS (
      INSERT INTO clientes_frecuentes
        (id, place_id, telefono, token, origen, sellos, sellos_totales, ciclo)
      VALUES (${clienteId}, ${placeId}, ${telefono}, ${token}, 'manual', 1, 1, 1)
      ON CONFLICT (place_id, telefono) DO NOTHING
      RETURNING id, ciclo
    ),
    cli AS (
      SELECT id, ciclo FROM cli_new
      UNION ALL
      SELECT c.id, c.ciclo
      FROM clientes_frecuentes c
      WHERE c.place_id = ${placeId} AND c.telefono = ${telefono}
      LIMIT 1
    ),
    mov AS (
      INSERT INTO movimientos_sellos
        (id, cliente_id, place_id, tipo, cantidad, pedido_id, ciclo, usuario_id, nota)
      SELECT ${movimientoId}, cli.id, ${placeId}, 'sello', 1, NULL, cli.ciclo,
             ${usuarioId}, ${nota}
      FROM cli
      RETURNING cliente_id
    ),
    upd AS (
      UPDATE clientes_frecuentes c
      SET sellos = c.sellos + 1,
          sellos_totales = c.sellos_totales + 1,
          actualizado_en = now()
      WHERE c.id IN (SELECT cliente_id FROM mov)
        AND c.id NOT IN (SELECT id FROM cli_new)
      RETURNING c.id
    )
    SELECT (SELECT id FROM cli) AS "clienteId"
  `);

  const id = resultado[0]?.clienteId;
  if (!id) return { estado: "telefono_invalido" };

  const cliente = await clientePorId(placeId, id);
  if (!cliente) return { estado: "telefono_invalido" };

  return {
    estado: "sumado",
    cliente,
    tarjeta: await tarjetaDe(config, cliente),
  };
}

/* ── canje y ajustes ────────────────────────────────────────────────────── */

export type ResultadoCanje =
  | { estado: "canjeado"; tarjeta: EstadoTarjeta; reinicio: boolean }
  | { estado: "no_disponible" }
  | { estado: "sin_funcion" }
  | { estado: "no_encontrado" };

/**
 * Canjea una meta alcanzada. Una vez por ciclo.
 *
 * La meta intermedia no resta sellos; la última reinicia la tarjeta: resta sus
 * sellos, sube el ciclo y deja los sobrantes. El movimiento guarda el ciclo en
 * el que se canjeó, y el índice único `(cliente, ciclo, meta)` impide dos
 * canjes simultáneos de la misma meta —el segundo `INSERT` choca y el `UPDATE`
 * no mueve nada—.
 */
export async function canjearMeta(
  placeId: string,
  clienteId: string,
  metaIndice: number,
  usuarioId: string | null,
): Promise<ResultadoCanje> {
  if (!(await tieneFuncion(placeId, "cliente_frecuente"))) {
    return { estado: "sin_funcion" };
  }
  const config = await configFidelidadDe(placeId);
  if (!config?.activo) return { estado: "sin_funcion" };

  const cliente = await clientePorId(placeId, clienteId);
  if (!cliente) return { estado: "no_encontrado" };

  const canjeadas = await canjeadasDe(cliente.id, cliente.ciclo);
  const canje = aplicarCanje(
    config,
    cliente.sellos,
    cliente.ciclo,
    metaIndice,
    canjeadas,
  );
  if (!canje) return { estado: "no_disponible" };

  const esUltima = metaIndice === config.metas.length - 1;
  const meta = config.metas[metaIndice]!;

  const resultado = await rows<{ id: string | null }>(sql`
    WITH mov AS (
      INSERT INTO movimientos_sellos
        (id, cliente_id, place_id, tipo, cantidad, meta_indice, ciclo, usuario_id)
      SELECT ${generateId()}, c.id, c.place_id, 'canje', ${canje.cantidad},
             ${metaIndice}, c.ciclo, ${usuarioId}
      FROM clientes_frecuentes c
      WHERE c.id = ${clienteId}
        AND c.place_id = ${placeId}
        AND c.sellos >= ${meta.sellos}
      ON CONFLICT DO NOTHING
      RETURNING cliente_id, cantidad
    ),
    upd AS (
      UPDATE clientes_frecuentes c
      SET sellos = GREATEST(0, c.sellos + (SELECT cantidad FROM mov)),
          ciclo = c.ciclo + ${esUltima ? 1 : 0},
          actualizado_en = now()
      WHERE c.id IN (SELECT cliente_id FROM mov)
      RETURNING c.id
    )
    SELECT (SELECT id FROM upd) AS "id"
  `);

  if (!resultado[0]?.id) return { estado: "no_disponible" };

  const actualizado = await clientePorId(placeId, clienteId);
  if (!actualizado) return { estado: "no_encontrado" };

  return {
    estado: "canjeado",
    reinicio: canje.reinicio,
    tarjeta: await tarjetaDe(config, actualizado),
  };
}

export type ResultadoAjuste =
  | { estado: "ajustado"; tarjeta: EstadoTarjeta }
  | { estado: "sin_funcion" }
  | { estado: "no_encontrado" }
  | { estado: "datos_invalidos" };

/**
 * Ajusta sellos a mano (+/-) con nota obligatoria.
 *
 * La nota es obligatoria porque el libro de movimientos es lo que explica, seis
 * meses después, por qué una tarjeta tiene los sellos que tiene. No toca
 * `sellos_totales`: un ajuste corrige la tarjeta, no son sellos ganados.
 */
export async function ajustarSellos(
  placeId: string,
  clienteId: string,
  cantidad: number,
  nota: string,
  usuarioId: string | null,
): Promise<ResultadoAjuste> {
  if (!Number.isInteger(cantidad) || cantidad === 0 || Math.abs(cantidad) > 100) {
    return { estado: "datos_invalidos" };
  }
  const limpia = nota.trim();
  if (!limpia) return { estado: "datos_invalidos" };

  const config = await configFidelidadDe(placeId);
  if (!config) return { estado: "sin_funcion" };

  const cliente = await clientePorId(placeId, clienteId);
  if (!cliente) return { estado: "no_encontrado" };

  await db.execute(sql`
    WITH mov AS (
      INSERT INTO movimientos_sellos
        (id, cliente_id, place_id, tipo, cantidad, ciclo, usuario_id, nota)
      SELECT ${generateId()}, c.id, c.place_id, 'ajuste', ${cantidad}, c.ciclo,
             ${usuarioId}, ${limpia.slice(0, 300)}
      FROM clientes_frecuentes c
      WHERE c.id = ${clienteId} AND c.place_id = ${placeId}
      RETURNING cliente_id
    )
    UPDATE clientes_frecuentes c
    SET sellos = GREATEST(0, c.sellos + ${cantidad}),
        actualizado_en = now()
    WHERE c.id IN (SELECT cliente_id FROM mov)
  `);

  const actualizado = await clientePorId(placeId, clienteId);
  if (!actualizado) return { estado: "no_encontrado" };
  return { estado: "ajustado", tarjeta: await tarjetaDe(config, actualizado) };
}

export type ResultadoAlta =
  | { estado: "creado"; cliente: ClienteTarjeta }
  | { estado: "telefono_invalido" }
  | { estado: "duplicado" }
  | { estado: "sin_funcion" }
  | { estado: "datos_invalidos" };

/**
 * Da de alta una tarjeta, con los sellos que el cliente ya tenía en papel.
 *
 * Es el camino para pasar las tarjetas impresas a digital. Los sellos
 * iniciales se apuntan como un `ajuste` con nota y cuentan también en el
 * histórico: son compras que ya hizo.
 */
export async function crearCliente(
  placeId: string,
  valorTelefono: string,
  nombre: string | null,
  sellosIniciales: number,
  nota: string,
  usuarioId: string | null,
): Promise<ResultadoAlta> {
  if (!(await tieneFuncion(placeId, "cliente_frecuente"))) {
    return { estado: "sin_funcion" };
  }

  const telefono = normalizarTelefono(valorTelefono);
  if (!telefono) return { estado: "telefono_invalido" };

  if (
    !Number.isInteger(sellosIniciales) ||
    sellosIniciales < 0 ||
    sellosIniciales > 1000
  ) {
    return { estado: "datos_invalidos" };
  }
  if (sellosIniciales > 0 && !nota.trim()) return { estado: "datos_invalidos" };

  const id = generateId();
  const token = nuevoToken();
  const nombreLimpio = nombre?.trim() ? nombre.trim().slice(0, 80) : null;

  const creado = await db
    .insert(clientesFrecuentes)
    .values({
      id,
      placeId,
      telefono,
      nombre: nombreLimpio,
      sellos: sellosIniciales,
      sellosTotales: sellosIniciales,
      token,
      origen: "manual",
    })
    .onConflictDoNothing({
      target: [clientesFrecuentes.placeId, clientesFrecuentes.telefono],
    })
    .returning();

  const fila = creado[0];
  if (!fila) return { estado: "duplicado" };

  if (sellosIniciales > 0) {
    await db.insert(movimientosSellos).values({
      id: generateId(),
      clienteId: fila.id,
      placeId,
      tipo: "ajuste",
      cantidad: sellosIniciales,
      ciclo: fila.ciclo,
      usuarioId,
      nota: nota.trim().slice(0, 300),
    });
  }

  return { estado: "creado", cliente: aClienteTarjeta(fila) };
}

/* ── estadísticas ───────────────────────────────────────────────────────── */

export interface Estadisticas {
  totalClientes: number;
  sellosEsteMes: number;
  canjesEsteMes: number;
  repitieron: number;
}

/** Métricas del 2×2 del panel. Se calculan en el servidor con zona Havana. */
export async function estadisticasFidelidad(placeId: string): Promise<Estadisticas> {
  const [cli] = await rows<{ total: number; repitieron: number }>(sql`
    SELECT
      COUNT(*)::int AS "total",
      COUNT(*) FILTER (WHERE sellos_totales >= 2)::int AS "repitieron"
    FROM clientes_frecuentes
    WHERE place_id = ${placeId}
  `);
  const [mov] = await rows<{ sellos: number; canjes: number }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE tipo = 'sello' AND anulado = false)::int AS "sellos",
      COUNT(*) FILTER (WHERE tipo = 'canje')::int AS "canjes"
    FROM movimientos_sellos
    WHERE place_id = ${placeId}
      AND creado_en >=
        date_trunc('month', now() AT TIME ZONE 'America/Havana') AT TIME ZONE 'America/Havana'
  `);
  return {
    totalClientes: cli?.total ?? 0,
    sellosEsteMes: mov?.sellos ?? 0,
    canjesEsteMes: mov?.canjes ?? 0,
    repitieron: cli?.repitieron ?? 0,
  };
}

/* ── sello por clienteId ────────────────────────────────────────────────── */

/**
 * Da un sello a un cliente existente por su id, sin pasar por el teléfono.
 * Lo llama el botón «+Sello» de la fila; requiere `pedidos`, no `ficha`.
 * Devuelve el movimientoId para que el frontend pueda deshacer en 6 s.
 */
export async function sellarClienteExistente(
  placeId: string,
  clienteId: string,
  usuarioId: string | null,
): Promise<
  | { estado: "sumado"; movimientoId: string }
  | { estado: "sin_funcion" | "inactiva" | "no_encontrado" }
> {
  if (!(await tieneFuncion(placeId, "cliente_frecuente"))) return { estado: "sin_funcion" };
  const config = await configFidelidadDe(placeId);
  if (!config?.activo) return { estado: "inactiva" };
  const cliente = await clientePorId(placeId, clienteId);
  if (!cliente) return { estado: "no_encontrado" };

  const movimientoId = generateId();
  await db.execute(sql`
    WITH mov AS (
      INSERT INTO movimientos_sellos
        (id, cliente_id, place_id, tipo, cantidad, ciclo, usuario_id)
      VALUES (${movimientoId}, ${clienteId}, ${placeId}, 'sello', 1, ${cliente.ciclo}, ${usuarioId})
      RETURNING cliente_id
    )
    UPDATE clientes_frecuentes c
    SET sellos = c.sellos + 1,
        sellos_totales = c.sellos_totales + 1,
        actualizado_en = now()
    WHERE c.id IN (SELECT cliente_id FROM mov)
  `);

  return { estado: "sumado", movimientoId };
}

/**
 * Deshace un sello manual (el movimiento queda anulado, no borrado).
 * Solo actúa si el movimiento existe, es un sello sin pedido y no está ya anulado.
 */
export async function deshacerSelloManual(
  placeId: string,
  movimientoId: string,
  usuarioId: string | null,
): Promise<{ deshecho: boolean }> {
  const resultado = await rows<{ n: number }>(sql`
    WITH anulado AS (
      UPDATE movimientos_sellos
      SET anulado = true
      WHERE id = ${movimientoId}
        AND place_id = ${placeId}
        AND tipo = 'sello'
        AND pedido_id IS NULL
        AND anulado = false
      RETURNING cliente_id, ciclo
    ),
    rev AS (
      INSERT INTO movimientos_sellos
        (id, cliente_id, place_id, tipo, cantidad, ciclo, usuario_id)
      SELECT ${generateId()}, cliente_id, ${placeId}, 'reversion', -1, ciclo, ${usuarioId}
      FROM anulado
      RETURNING cliente_id
    ),
    upd AS (
      UPDATE clientes_frecuentes c
      SET sellos = GREATEST(0, c.sellos - 1),
          sellos_totales = GREATEST(0, c.sellos_totales - 1),
          actualizado_en = now()
      WHERE c.id IN (SELECT cliente_id FROM rev)
      RETURNING c.id
    )
    SELECT count(*)::int AS "n" FROM upd
  `);
  return { deshecho: (resultado[0]?.n ?? 0) > 0 };
}

export async function borrarCliente(
  placeId: string,
  clienteId: string,
): Promise<boolean> {
  const borrado = await db
    .delete(clientesFrecuentes)
    .where(
      and(
        eq(clientesFrecuentes.id, clienteId),
        eq(clientesFrecuentes.placeId, placeId),
      ),
    )
    .returning({ id: clientesFrecuentes.id });
  return borrado.length > 0;
}

/* ── lecturas del panel ─────────────────────────────────────────────────── */

export interface FilaCliente extends ResumenTarjeta {
  sellosTotales: number;
  origen: "pedido" | "manual";
  actualizadoEn: Date;
  premioListo: string | null;
}

/**
 * La lista de tarjetas del negocio, por actividad reciente.
 *
 * La búsqueda va en el servidor y no en el navegador: la lista puede crecer y
 * el teléfono escrito a medias tiene que encontrar igual. Se busca por nombre o
 * por teléfono tal cual se teclee.
 */
export async function listarClientes(
  placeId: string,
  busqueda: string,
  config: FidelidadConfig,
): Promise<FilaCliente[]> {
  const q = busqueda.trim();
  const patron = `%${q}%`;

  const filas = await db
    .select()
    .from(clientesFrecuentes)
    .where(
      q
        ? and(
            eq(clientesFrecuentes.placeId, placeId),
            or(
              ilike(clientesFrecuentes.telefono, patron),
              ilike(clientesFrecuentes.nombre, patron),
            ),
          )
        : eq(clientesFrecuentes.placeId, placeId),
    )
    .orderBy(desc(clientesFrecuentes.actualizadoEn))
    .limit(100);

  if (filas.length === 0) return [];

  const canjes = await db
    .select({
      clienteId: movimientosSellos.clienteId,
      ciclo: movimientosSellos.ciclo,
      meta: movimientosSellos.metaIndice,
    })
    .from(movimientosSellos)
    .where(
      and(
        eq(movimientosSellos.placeId, placeId),
        eq(movimientosSellos.tipo, "canje"),
        inArray(
          movimientosSellos.clienteId,
          filas.map((f) => f.id),
        ),
      ),
    );

  return filas.map((fila) => {
    const cliente = aClienteTarjeta(fila);
    const canjeadas = canjes
      .filter((c) => c.clienteId === cliente.id && c.ciclo === cliente.ciclo)
      .map((c) => c.meta)
      .filter((meta): meta is number => meta !== null && meta >= 0);
    const tarjeta = estadoTarjeta(config, cliente.sellos, cliente.ciclo, canjeadas);
    return {
      ...resumenDe(cliente, tarjeta),
      sellosTotales: cliente.sellosTotales,
      origen: cliente.origen,
      actualizadoEn: cliente.actualizadoEn,
      premioListo: tarjeta.listas[0]?.premio ?? null,
    };
  });
}

export interface MovimientoVista {
  id: string;
  tipo: "sello" | "ajuste" | "canje" | "reversion";
  cantidad: number;
  nota: string | null;
  metaIndice: number | null;
  ciclo: number;
  creadoEn: Date;
  usuario: string | null;
  pedidoCodigo: string | null;
  anulado: boolean;
}

export interface DetalleCliente {
  cliente: ClienteTarjeta;
  tarjeta: EstadoTarjeta;
  movimientos: MovimientoVista[];
}

export async function detalleCliente(
  placeId: string,
  clienteId: string,
  config: FidelidadConfig,
): Promise<DetalleCliente | null> {
  const cliente = await clientePorId(placeId, clienteId);
  if (!cliente) return null;

  const filas = await db
    .select({
      id: movimientosSellos.id,
      tipo: movimientosSellos.tipo,
      cantidad: movimientosSellos.cantidad,
      nota: movimientosSellos.nota,
      metaIndice: movimientosSellos.metaIndice,
      ciclo: movimientosSellos.ciclo,
      creadoEn: movimientosSellos.creadoEn,
      anulado: movimientosSellos.anulado,
      usuario: users.name,
      pedidoCodigo: pedidos.codigo,
    })
    .from(movimientosSellos)
    .leftJoin(users, eq(movimientosSellos.usuarioId, users.id))
    .leftJoin(pedidos, eq(movimientosSellos.pedidoId, pedidos.id))
    .where(eq(movimientosSellos.clienteId, cliente.id))
    .orderBy(desc(movimientosSellos.creadoEn))
    .limit(50);

  return {
    cliente,
    tarjeta: await tarjetaDe(config, cliente),
    movimientos: filas,
  };
}

/**
 * La tarjeta de un teléfono con su estado.
 *
 * La usan el panel y Telegram: el teléfono se normaliza antes de buscar, así
 * que da igual cómo lo escriba la dependienta. `null` si no hay tarjeta o el
 * negocio no la tiene activa.
 */
export async function tarjetaPorTelefono(
  placeId: string,
  valorTelefono: string,
): Promise<{ cliente: ClienteTarjeta; tarjeta: EstadoTarjeta } | null> {
  const config = await configFidelidadDe(placeId);
  if (!config?.activo) return null;
  const cliente = await clientePorTelefono(placeId, valorTelefono);
  if (!cliente) return null;
  return { cliente, tarjeta: await tarjetaDe(config, cliente) };
}

/* ── negocio ────────────────────────────────────────────────────────────── */

/** Lo que necesita el panel para armar el enlace de la tarjeta y la vista previa. */
export async function negocioPublico(placeId: string): Promise<{
  id: string;
  nombre: string;
  slug: string;
  logoUrl: string | null;
} | null> {
  const [fila] = await db
    .select({
      id: places.id,
      nombre: places.name,
      slug: places.slug,
      logoUrl: places.logoUrl,
    })
    .from(places)
    .where(eq(places.id, placeId))
    .limit(1);
  return fila ?? null;
}

/* ── tarjeta pública ────────────────────────────────────────────────────── */

export interface TarjetaPublica {
  cliente: ClienteTarjeta;
  tarjeta: EstadoTarjeta;
  negocio: { id: string; nombre: string; slug: string; logoUrl: string | null };
  movimientos: MovimientoVista[];
}

/**
 * La tarjeta que abre el cliente desde el enlace.
 *
 * Solo por token, nunca por teléfono: el token es largo y aleatorio. Si no
 * existe, el cliente se borró o el negocio ya no tiene la tarjeta activa, se
 * devuelve `null` y la página dice que ya no existe.
 */
export async function tarjetaPublica(token: string): Promise<TarjetaPublica | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;

  const [fila] = await db
    .select({
      cliente: clientesFrecuentes,
      nombre: places.name,
      slug: places.slug,
      logoUrl: places.logoUrl,
      fidelidad: places.fidelidad,
    })
    .from(clientesFrecuentes)
    .innerJoin(places, eq(clientesFrecuentes.placeId, places.id))
    .where(eq(clientesFrecuentes.token, token))
    .limit(1);

  if (!fila) return null;
  if (!fila.fidelidad || !esFidelidadConfig(fila.fidelidad)) return null;
  if (!fila.fidelidad.activo) return null;
  if (!(await tieneFuncion(fila.cliente.placeId, "cliente_frecuente"))) return null;

  const cliente = aClienteTarjeta(fila.cliente);
  const movimientos = await db
    .select({
      id: movimientosSellos.id,
      tipo: movimientosSellos.tipo,
      cantidad: movimientosSellos.cantidad,
      nota: movimientosSellos.nota,
      metaIndice: movimientosSellos.metaIndice,
      ciclo: movimientosSellos.ciclo,
      creadoEn: movimientosSellos.creadoEn,
      anulado: movimientosSellos.anulado,
      usuario: sql<string | null>`NULL`,
      pedidoCodigo: pedidos.codigo,
    })
    .from(movimientosSellos)
    .leftJoin(pedidos, eq(movimientosSellos.pedidoId, pedidos.id))
    .where(eq(movimientosSellos.clienteId, cliente.id))
    .orderBy(desc(movimientosSellos.creadoEn))
    .limit(12);

  return {
    cliente,
    tarjeta: await tarjetaDe(fila.fidelidad, cliente),
    negocio: {
      id: fila.cliente.placeId,
      nombre: fila.nombre,
      slug: fila.slug,
      logoUrl: fila.logoUrl,
    },
    movimientos,
  };
}
