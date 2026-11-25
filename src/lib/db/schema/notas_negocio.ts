import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { places } from "./places";
import { users } from "./users";

/**
 * La nota interna de un negocio.
 *
 * Una fila por negocio (`place_id` es la clave) y solo se escribe desde el
 * panel de administración. No es una descripción pública ni la ve el dueño: es
 * el sitio donde quien atiende apunta el contexto que no cabe en una ficha
 * («llamó por la mañana», «debe la renovación de octubre»).
 *
 * Va en tabla aparte y no en una columna de `places` porque es una anotación
 * del panel, no un dato del negocio, y así un cambio de esquema de la ficha no
 * la arrastra. `onDelete: cascade`: sin negocio no hay nota que guardar.
 */
export const notasNegocio = pgTable("notas_negocio", {
  placeId: text("place_id")
    .primaryKey()
    .references(() => places.id, { onDelete: "cascade" }),
  nota: text("nota").notNull().default(""),
  /** Quién la escribió por última vez. `set null` si esa cuenta se borra. */
  actualizadoPor: text("actualizado_por").references(() => users.id, {
    onDelete: "set null",
  }),
  actualizadoEn: timestamp("actualizado_en").defaultNow().notNull(),
});
