import { pgTable, text, timestamp, index, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { places } from "./places";

/**
 * Lo que un negocio de pago cambió en su carta, para enseñarlo en el home.
 *
 * Las **ofertas no se guardan aquí**: su vigencia ya vive en `ofertas` y se lee
 * en vivo. Esta tabla solo cubre lo que no deja rastro en otro sitio —un
 * producto nuevo, un precio que subió o bajó, una ficha que reabre o cambia de
 * horario—. Se escribe desde el `PATCH` de `places` y se lee en
 * `/api/novedades`.
 *
 * `producto_id` apunta a una entrada del jsonb `places.menu`, igual que en
 * `ofertas`: no hay fila contra la que hacer clave foránea. `producto_nombre` se
 * copia al crear la novedad porque el producto puede desaparecer después y el
 * aviso tiene que seguir teniendo algo que enseñar.
 *
 * No hay cron de limpieza: el endpoint lee solo los últimos 14 días
 * (`DIAS_NOVEDAD`).
 */
export const novedades = pgTable(
  "novedades",
  {
    id: text("id").primaryKey(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),

    tipo: text("tipo", {
      enum: ["producto_nuevo", "cambio_precio", "actualizacion"],
    }).notNull(),

    titulo: text("titulo").notNull(),
    texto: text("texto"),

    productoId: text("producto_id"),
    productoNombre: text("producto_nombre"),
    imagenUrl: text("imagen_url"),
    /* Texto y no número, como los precios de la carta: el dueño escribe
       «150», «2.50» o «3–5 USD» y se enseña tal cual. */
    precioAntes: text("precio_antes"),
    precioAhora: text("precio_ahora"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    negocioFechaIdx: index("novedades_negocio_fecha_idx").on(
      table.negocioId,
      table.createdAt,
    ),
    tipoCheck: check(
      "novedades_tipo_check",
      sql`${table.tipo} in ('producto_nuevo', 'cambio_precio', 'actualizacion')`,
    ),
  }),
);

export const novedadRelations = relations(novedades, ({ one }) => ({
  negocio: one(places, {
    fields: [novedades.negocioId],
    references: [places.id],
  }),
}));
