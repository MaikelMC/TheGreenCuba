import { pgTable, text, timestamp, jsonb, index, uniqueIndex, doublePrecision, boolean } from "drizzle-orm/pg-core";
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
    /** Teléfono normalizado del cliente para la tarjeta de sellos.
     *  `null` = no lo dejó (o el negocio no tiene la función). */
    telefonoCliente: text("telefono_cliente"),
    /** «recogida» o «domicilio». `null` si el negocio no tenía zonas configuradas. */
    modoEntrega: text("modo_entrega", { enum: ["recogida", "domicilio"] }),
    /** Copia del nombre de la zona en el momento del pedido. */
    zonaNombre: text("zona_nombre"),
    /** Costo del envío aplicado. `null` si era recogida o sin zonas. */
    costoEnvio: doublePrecision("costo_envio"),
    /** Moneda del costo de envío. */
    costoEnvioMoneda: text("costo_envio_moneda"),
    /** Tasa CUP/USD con la que se calcularon los precios al hacer el pedido.
        `null` si el negocio no tenía la tasa activa en ese momento. */
    tasaUsada: doublePrecision("tasa_usada"),
    /** `true` si el pedido llegó fuera del horario de cocina. Solo informativo:
     *  el pedido se guarda igual para que el dueño lo vea y decida. */
    fueraDeHorario: boolean("fuera_de_horario").default(false).notNull(),
    /** Código corto de 5 caracteres, único por negocio. Aparece en WhatsApp y en el panel. */
    codigo: text("codigo").notNull(),
    /** La franja para la que se programó el pedido. `null` = «lo antes posible». */
    programadoPara: timestamp("programado_para", { withTimezone: true }),
    /** Si la hora programada no pudo validarse completamente en el servidor. */
    revisarHora: boolean("revisar_hora").default(false).notNull(),
    /** Motivo de revisión: "franja_llena" | "fuera_de_horario" | "sin_antelacion" | "fuera_de_dias" | "sin_funcion". */
    revisarMotivo: text("revisar_motivo"),
    /** Cuándo se envió el aviso por Telegram. `null` = pendiente. */
    avisadoEn: timestamp("avisado_en", { withTimezone: true }),
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
    codigoNegocioIdx: uniqueIndex("pedidos_place_codigo_idx").on(
      table.placeId,
      table.codigo,
    ),
    /* Para encontrar los pedidos de un teléfono al pintar la tarjeta o avisar. */
    placeTelefonoIdx: index("pedidos_place_telefono_idx").on(
      table.placeId,
      table.telefonoCliente,
    ),
  }),
);

export const pedidoRelations = relations(pedidos, ({ one }) => ({
  negocio: one(places, {
    fields: [pedidos.placeId],
    references: [places.id],
  }),
}));
