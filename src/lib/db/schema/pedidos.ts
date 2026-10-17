import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { places } from "./places";
import type { LineaPedido } from "../../pedido";

/**
 * Los pedidos que entran por el catálogo online.
 *
 * Hasta ahora el carrito solo armaba un mensaje de WhatsApp y La Verde no
 * guardaba nada: si el dueño no estaba delante, el pedido se perdía entre los
 * demás chats y no quedaba constancia de qué se pidió ni cuándo. Esta tabla es
 * ese registro.
 *
 * **Las líneas van en `jsonb` y no en una tabla aparte** por la misma razón que
 * la carta: el precio es texto libre («3–5 USD», «Desde 8») y una tabla con
 * `numeric` lo perdería. Además el pedido es una foto del momento —lo que se
 * pidió y a qué precio—, no una relación viva con el menú: si el dueño cambia
 * el precio mañana, el pedido de ayer tiene que seguir diciendo el de ayer.
 *
 * No guarda quién lo hizo. El cliente pide sin cuenta y la única forma de
 * contactarlo es la dirección de entrega, que es opcional. La conversación
 * sigue siendo el WhatsApp del negocio.
 */
export const pedidos = pgTable(
  "pedidos",
  {
    id: text("id").primaryKey(),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    /** Lo pedido, tal como se armó el mensaje: nombre, precio y cantidad. */
    lineas: jsonb("lineas").$type<LineaPedido[]>().notNull(),
    /** Dónde se entrega. Vacío o `null` = el cliente lo recoge. */
    direccion: text("direccion"),
    estado: text("estado", { enum: ["nuevo", "completado", "cancelado"] })
      .default("nuevo")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    /* La única lectura que hay: los pedidos de un negocio, del más nuevo al más
       viejo. El compuesto sirve igual para contar los de un negocio. */
    negocioFechaIdx: index("pedidos_negocio_fecha_idx").on(
      table.placeId,
      table.createdAt,
    ),
  }),
);

export const pedidoRelations = relations(pedidos, ({ one }) => ({
  negocio: one(places, {
    fields: [pedidos.placeId],
    references: [places.id],
  }),
}));
