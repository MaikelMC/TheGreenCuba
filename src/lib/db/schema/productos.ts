import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { places } from "./places";

/**
 * Los productos de la carta de un negocio, uno por fila.
 *
 * Sustituye al jsonb `places.menu`, que guardaba la carta entera en una sola
 * celda. Con una fila por producto cada uno tiene un `id` estable para siempre
 * —sin el respaldo por posición que tenía el jsonb—, el panel, Telegram y la
 * importación pueden guardar un producto sin reescribir los demás, y `version`
 * permite detectar que alguien cambió el producto desde que se leyó.
 *
 * **Transición.** Mientras dure la migración, `places.menu` sigue existiendo:
 * en la fase A esta tabla se llena con `scripts/migrar-productos.ts` y nadie la
 * lee todavía; en la B se pasan las lecturas; en la C, las escrituras.
 *
 * **El precio va dos veces, a propósito.** `precio_texto` es lo que escribió el
 * dueño («3–5 USD», «Desde 8», «A convenir») y es lo que se enseña cuando no hay
 * número. `precio` es la cifra que el servidor sabe calcular sin ambigüedad
 * —la usan el carrito y el pedido—, y queda `null` cuando el texto no es una
 * cifra clara. La conversión vive en `src/lib/productos.ts` y es la misma en
 * todas las vías de escritura.
 *
 * Pensada para crecer: las formas de venta por producto (unidad, decena, caja)
 * irán en una tabla hija que apunte a `productos.id`. No existe todavía.
 */
export const productos = pgTable(
  "productos",
  {
    /** Estable para siempre. Los ids viejos del jsonb se conservan. */
    id: text("id").primaryKey(),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    /** Posición en la carta. No es parte de la identidad: reordenar no cambia el id. */
    orden: integer("orden").notNull(),
    /** Familia del producto, texto libre del dueño («Bebidas»). */
    categoria: text("categoria"),

    nombre: text("nombre").notNull(),
    descripcion: text("descripcion").notNull().default(""),
    /** URL pública de la foto en el bucket. */
    imagen: text("imagen"),
    /** Chapita («Popular», «Nuevo», «2x1»). */
    tag: text("tag"),

    /** El precio tal como lo escribió el dueño. */
    precioTexto: text("precio_texto").notNull().default(""),
    /** La cifra, solo si el texto se convierte sin ambigüedad. */
    precio: numeric("precio", { precision: 12, scale: 2 }),
    moneda: text("moneda").notNull(),
    tipoPrecio: text("tipo_precio", { enum: ["fijo", "desde", "consultar"] })
      .notNull()
      .default("fijo"),

    disponibilidad: text("disponibilidad", { enum: ["disponible", "agotado"] })
      .notNull()
      .default("disponible"),
    /** Cuándo vuelve solo a estar disponible. `null` = sin fecha. */
    agotadoHasta: timestamp("agotado_hasta", { withTimezone: true }),
    oculto: boolean("oculto").notNull().default(false),
    destacado: boolean("destacado").notNull().default(false),
    /** Existencias exactas. `null` = no se lleva la cuenta. */
    stock: integer("stock"),

    /** Duración del servicio, en minutos. Solo la usa el módulo servicios. */
    duracionMin: integer("duracion_min"),
    /** Identificador en el ERP del negocio, para la futura sincronización. */
    externalId: text("external_id"),
    /** Marca de la importación CSV que lo creó. Es lo que deshace la importación. */
    importacionId: text("importacion_id"),

    /** Bloqueo optimista: cada cambio de contenido la sube en uno. */
    version: integer("version").notNull().default(1),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    /* La lectura de siempre: la carta de un negocio, en su orden. */
    placeOrdenIdx: index("productos_place_orden_idx").on(table.placeId, table.orden),
    placeCategoriaIdx: index("productos_place_categoria_idx").on(
      table.placeId,
      table.categoria,
    ),
    /* «Deshacer importación» borra por esta marca dentro de un negocio. */
    placeImportacionIdx: index("productos_place_importacion_idx").on(
      table.placeId,
      table.importacionId,
    ),
    precioCheck: check(
      "productos_precio_check",
      sql`${table.precio} is null or ${table.precio} >= 0`,
    ),
    tipoPrecioCheck: check(
      "productos_tipo_precio_check",
      sql`${table.tipoPrecio} in ('fijo', 'desde', 'consultar')`,
    ),
    disponibilidadCheck: check(
      "productos_disponibilidad_check",
      sql`${table.disponibilidad} in ('disponible', 'agotado')`,
    ),
    stockCheck: check(
      "productos_stock_check",
      sql`${table.stock} is null or ${table.stock} >= 0`,
    ),
  }),
);

export const productoRelations = relations(productos, ({ one }) => ({
  negocio: one(places, {
    fields: [productos.placeId],
    references: [places.id],
  }),
}));

export type ProductoRow = typeof productos.$inferSelect;
export type ProductoInsert = typeof productos.$inferInsert;
