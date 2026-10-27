import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { places } from "./places";
import { users } from "./users";

/**
 * Enlaces de invitación al equipo de un negocio.
 *
 * Existe porque `business_owners` apunta a `users.id`, así que añadir a alguien
 * por correo exige que ya tenga cuenta. Con esto, el dueño manda un enlace y la
 * persona se registra desde ahí: al aceptarlo nace su fila de trabajador con los
 * permisos que el dueño marcó al generarlo.
 *
 * `token` es el secreto que viaja en la URL. Caduca y se consume una sola vez;
 * `accepted_at`/`accepted_by` dejan constancia de quién lo usó.
 */
export const businessInvitations = pgTable(
  "business_invitations",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    /* Los permisos que tendrá el trabajador al aceptar. Se normalizan al
       generarlos y otra vez al aceptarlos, con `normalizarPermisos`. */
    permissions: jsonb("permissions").$type<string[]>().default([]).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    /* `set null` y no `cascade`: borrar la cuenta del trabajador no tiene que
       borrar la constancia de que el enlace se usó. */
    acceptedBy: text("accepted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    placeIdx: index("business_invitations_place_idx").on(table.placeId),
  }),
);
