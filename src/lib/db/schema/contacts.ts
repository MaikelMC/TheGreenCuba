import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Consentimiento de novedades por correo.
 *
 * Tabla aparte de `users` y no una columna más: es el registro de una decisión
 * legal, y el sentido del dato es distinto al del perfil. Aquí no hay nada que
 * consultar para pintar la interfaz, solo a quién se le puede escribir.
 *
 * La clave es `user_id` a secas —una fila por persona, sin id propio—: nadie
 * pregunta por la fila, se pregunta «¿esta persona quiere novedades?». Y
 * `onDelete: cascade` porque caer aquí con la cuenta es justo lo que prometen
 * los términos al hablar de supresión.
 *
 * `opted_in_at` es la fecha de la decisión **vigente**, no un histórico: al
 * darse de baja vuelve a `null`. Un histórico completo, si algún día hace
 * falta, es otra tabla —la misma decisión que en `users.terms_version`.
 */
export const contacts = pgTable("contacts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  marketingOptIn: boolean("marketing_opt_in").default(false).notNull(),
  optedInAt: timestamp("opted_in_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
