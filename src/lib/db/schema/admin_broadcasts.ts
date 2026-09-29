import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Envíos masivos de administración a todos los usuarios.
 *
 * El mensaje se inserta una vez aquí y una fila por usuario en `notifications`
 * (tipo `broadcast`, remitente "Support La Verde"): las notificaciones del
 * usuario solo leen por `user_id`, y tocarlas obligaría a cambiar la consulta
 * de cada pantalla que las pinta. El broadcast guarda el historial —quién lo
 * mandó, cuándo, a cuántos— y permite reenviar o corregir sin excavar en las
 * filas de cada destinatario.
 *
 * `recipientCount` se fija al insertar las filas de `notifications`: es la
 * prueba de a cuántos llegó de verdad, no de a cuántos se intentó.
 */
export const adminBroadcasts = pgTable("admin_broadcasts", {
  id: text("id").primaryKey(),
  /** Administrador que lo envió. `set null` al borrarse la cuenta: el envío
      queda, el nombre se conserva en `senderName`. */
  senderId: text("sender_id").references(() => users.id, { onDelete: "set null" }),
  senderName: text("sender_name"),

  title: text("title").notNull(),
  message: text("message").notNull(),

  /** A cuántos usuarios llegó de verdad, fijado al insertar las filas de
      `notifications`. */
  recipientCount: integer("recipient_count").notNull().default(0),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
