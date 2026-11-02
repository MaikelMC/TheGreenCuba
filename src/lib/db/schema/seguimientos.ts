import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { places } from "./places";
import { users } from "./users";

/**
 * «Avísame» desde la app: un usuario con sesión sigue a un negocio para recibir
 * sus novedades en el móvil.
 *
 * Es la pareja en la app de `seguidores`, que guarda los chats de Telegram. Se
 * mantienen **separadas** a propósito: aquella tabla no apunta a un usuario —quien
 * abre el enlace del bot casi nunca tiene cuenta— y su `destino` es un chat, no
 * una identidad. Meter aquí el `user_id` en la misma columna mezclaría dos tipos
 * de dirección y dejaría las consultas del tope semanal de Telegram contando
 * gente de la app.
 *
 * Una fila por usuario y negocio: volver a pulsar «Avísame» no duplica y la baja
 * borra la fila, porque a diferencia de Telegram aquí no hay historial que
 * conservar ni consentimiento que sellar dos veces —la sesión ya identifica a la
 * persona—.
 */
export const seguimientos = pgTable(
  "seguimientos",
  {
    id: text("id").primaryKey(),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    claveUnique: unique("seguimientos_clave_unique").on(
      table.usuarioId,
      table.negocioId,
    ),
    /* Quién sigue a un negocio: es la lectura del envío. */
    negocioIdx: index("seguimientos_negocio_idx").on(table.negocioId),
    /* Qué sigue un usuario: la usa la ficha al abrir el diálogo. */
    usuarioIdx: index("seguimientos_usuario_idx").on(table.usuarioId),
  }),
);

export const seguimientoRelations = relations(seguimientos, ({ one }) => ({
  usuario: one(users, {
    fields: [seguimientos.usuarioId],
    references: [users.id],
  }),
  negocio: one(places, {
    fields: [seguimientos.negocioId],
    references: [places.id],
  }),
}));
