import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Suscripciones de notificaciones push del navegador.
 *
 * Una fila por dispositivo y navegador. `endpoint` es único porque es el
 * identificador que da el servicio push (FCM, Mozilla, Apple): dos filas con el
 * mismo endpoint serían dos envíos al mismo sitio.
 *
 * Las claves `p256dh` y `auth` las genera el navegador al suscribirse y son
 * necesarias para cifrar el contenido; sin ellas el servicio push solo entrega
 * el mensaje vacío.
 *
 * `failureCount` cuenta fallos temporales (429, 5xx). Un 404 o un 410 significa
 * que la suscripción ya no existe y la fila se borra en el envío.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastSuccessAt: timestamp("last_success_at"),
    failureCount: integer("failure_count").default(0).notNull(),
  },
  (table) => ({
    userIdx: index("push_subscriptions_user_idx").on(table.userId),
  }),
);
