import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

/**
 * La copia personal de una ficha que **no vive en la base**.
 *
 * Hoy solo la usa el negocio de prueba (`dev-place.ts`): es un fixture en
 * memoria, sin fila en `places`, así que no se le puede colgar un
 * `business_owners` ni un `PATCH` puede actualizarlo. Para que su dueño —la
 * cuenta autorizada— pueda verlo y editarlo como si fuera suyo, sus cambios se
 * guardan aquí, **atados a su usuario**.
 *
 * Vive aparte y no en `users.preferences` por un motivo concreto: el perfil y el
 * onboarding reescriben `preferences` entero, así que una ficha metida ahí se
 * perdería al primer guardado de preferencias.
 *
 * `data` es un `Partial<UserPlace>` serializado (el cuerpo que manda el `PATCH`)
 * y se fusiona sobre el fixture al leer. `userId` es la clave primaria: un
 * usuario tiene como mucho una copia del fixture, y así el `onConflict` de la
 * escritura actualiza en vez de acumular.
 */
export const placeOverrides = pgTable("place_overrides", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** El id de la ficha fixture. Sin clave foránea: no existe en `places`. */
  placeId: text("place_id").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  /**
   * El plan elegido para el fixture, para poder probar cada plan a voluntad.
   *
   * Va aquí y no en `suscripciones` porque esa tabla tiene clave foránea a
   * `places` y el fixture no existe allí. `planEfectivoDe(DEV_PLACE_ID)` lee
   * esta columna; `null` significa gratis. Es global al fixture, no por
   * usuario: es una herramienta de prueba y solo lo ve su dueño.
   */
  plan: text("plan", { enum: ["gratis", "basico", "pro"] }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const placeOverrideRelations = relations(placeOverrides, ({ one }) => ({
  user: one(users, {
    fields: [placeOverrides.userId],
    references: [users.id],
  }),
}));
