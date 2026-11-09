import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { places } from "./places";
import { pedidos } from "./pedidos";
import { users } from "./users";

/**
 * Un cliente de la tarjeta de sellos.
 *
 * El teléfono es la identidad: el cliente pide sin cuenta y deja su número en
 * el carrito. `sellos` es el ciclo actual —puede pasar de la última meta y
 * guardar sobrantes— y `sellos_totales` el histórico de sellos ganados menos
 * reversiones; los ajustes manuales y los canjes no lo mueven.
 *
 * `token` es la llave del enlace público. Se guarda en claro porque el enlace
 * se vuelve a mandar por WhatsApp; no se busca una tarjeta por teléfono desde
 * fuera.
 */
export const clientesFrecuentes = pgTable(
  "clientes_frecuentes",
  {
    id: text("id").primaryKey(),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    /** Normalizado a `+53XXXXXXXX` por `src/lib/telefono.ts`. */
    telefono: text("telefono").notNull(),
    nombre: text("nombre"),
    /** Sellos del ciclo actual. */
    sellos: integer("sellos").default(0).notNull(),
    /** Histórico: sellos ganados menos reversiones. */
    sellosTotales: integer("sellos_totales").default(0).notNull(),
    /** Ciclo actual. Empieza en 1 y sube al canjear la última meta. */
    ciclo: integer("ciclo").default(1).notNull(),
    /** Aleatorio y largo; la única forma de abrir la tarjeta desde fuera. */
    token: text("token").notNull(),
    origen: text("origen", { enum: ["pedido", "manual"] })
      .default("manual")
      .notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    placeTelefonoUnique: uniqueIndex("clientes_frecuentes_place_telefono_idx").on(
      table.placeId,
      table.telefono,
    ),
    tokenUnique: uniqueIndex("clientes_frecuentes_token_idx").on(table.token),
    /** La lista del panel: los de actividad más reciente primero. */
    placeActividadIdx: index("clientes_frecuentes_place_actividad_idx").on(
      table.placeId,
      table.actualizadoEn,
    ),
  }),
);

/**
 * El libro de movimientos: la fuente de verdad de los sellos.
 *
 * `cantidad` va con signo. Un `sello` suma 1, una `reversion` resta 1, un
 * `ajuste` suma o resta lo que diga el dueño y un `canje` intermedio no mueve
 * sellos —`0`—; el canje de la última meta resta los sellos de esa meta.
 *
 * `anulado` marca el sello que ya fue revertido. El índice único parcial deja
 * **un solo sello activo por pedido**, así que dos peticiones simultáneas que
 * marcan el mismo pedido como entregado no pueden sumar dos veces; al
 * cancelarlo se anula ese sello y el pedido puede volver a sumar si se
 * completa otra vez. Las reversiones también se apoyan en ese estado: solo se
 * crea una si había un sello activo que anular.
 */
export const movimientosSellos = pgTable(
  "movimientos_sellos",
  {
    id: text("id").primaryKey(),
    clienteId: text("cliente_id")
      .notNull()
      .references(() => clientesFrecuentes.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    tipo: text("tipo", {
      enum: ["sello", "ajuste", "canje", "reversion"],
    }).notNull(),
    /** Con signo: +1, -1, +n, -n o 0. */
    cantidad: integer("cantidad").notNull(),
    /** El pedido que lo provocó. `null` si fue a mano. */
    pedidoId: text("pedido_id").references(() => pedidos.id, {
      onDelete: "set null",
    }),
    /** Índice de la meta canjeada, para no canjearla dos veces por ciclo. */
    metaIndice: integer("meta_indice"),
    /** Ciclo en el que ocurrió. */
    ciclo: integer("ciclo").notNull(),
    /** Quién lo hizo: dueño o trabajador. `null` si fue automático. */
    usuarioId: text("usuario_id").references(() => users.id, {
      onDelete: "set null",
    }),
    nota: text("nota"),
    /** El sello que ya no cuenta porque el pedido se canceló. */
    anulado: boolean("anulado").default(false).notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    clienteFechaIdx: index("movimientos_sellos_cliente_fecha_idx").on(
      table.clienteId,
      table.creadoEn,
    ),
    placeFechaIdx: index("movimientos_sellos_place_fecha_idx").on(
      table.placeId,
      table.creadoEn,
    ),
    /** Un pedido nunca da más de un sello neto: solo un sello activo. */
    selloActivoUnique: uniqueIndex("movimientos_sellos_pedido_activo_idx")
      .on(table.pedidoId)
      .where(sql`${table.tipo} = 'sello' and ${table.anulado} = false`),
    /** Una meta se canjea una vez por ciclo, aunque lleguen dos peticiones. */
    canjeUnico: uniqueIndex("movimientos_sellos_canje_idx")
      .on(table.clienteId, table.ciclo, table.metaIndice)
      .where(sql`${table.tipo} = 'canje'`),
  }),
);

export const clientesFrecuentesRelations = relations(clientesFrecuentes, ({ one, many }) => ({
  negocio: one(places, {
    fields: [clientesFrecuentes.placeId],
    references: [places.id],
  }),
  movimientos: many(movimientosSellos),
}));

export const movimientosSellosRelations = relations(movimientosSellos, ({ one }) => ({
  cliente: one(clientesFrecuentes, {
    fields: [movimientosSellos.clienteId],
    references: [clientesFrecuentes.id],
  }),
  negocio: one(places, {
    fields: [movimientosSellos.placeId],
    references: [places.id],
  }),
  pedido: one(pedidos, {
    fields: [movimientosSellos.pedidoId],
    references: [pedidos.id],
  }),
}));
