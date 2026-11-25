import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Respuestas guardadas de Soporte.
 *
 * Son textos que el equipo reutiliza al contestar (“cómo cambiar el horario”,
 * “qué hacer si no aparece la ficha”). Viven en una tabla y no en el código
 * porque las dos personas que atienden el panel las editan sin desplegar.
 *
 * `created_by` es solo la traza de quién la escribió: si esa cuenta se borra,
 * la respuesta sigue siendo útil y se queda con `null`, igual que los tickets.
 */
export const supportSavedReplies = pgTable("support_saved_replies", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
