import { pgTable, text, timestamp, index, unique, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { places } from "./places";
import { users } from "./users";

export const businessOwners = pgTable(
  "business_owners",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "manager", "editor"] })
      .default("owner")
      .notNull(),
    /* Qué puede tocar un trabajador. El dueño (`role = owner`) no las mira:
       tiene todas, y por eso su fila puede quedarse con la lista vacía. Se
       guardan como jsonb y no como cuatro columnas booleanas porque los
       permisos van a crecer —hoy son los de `permisos-negocio.ts`— y una
       columna por permiso obligaría a migrar por cada uno. */
    permissions: jsonb("permissions").$type<string[]>().default([]).notNull(),
    invitedAt: timestamp("invited_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
  },
  (table) => ({
    userPlaceUnique: unique("business_owners_user_place_unique").on(table.userId, table.placeId),
    userIdx: index("business_owners_user_idx").on(table.userId),
    placeIdx: index("business_owners_place_idx").on(table.placeId),
  }),
);

export const businessOwnerRelations = relations(businessOwners, ({ one }) => ({
  user: one(users, {
    fields: [businessOwners.userId],
    references: [users.id],
  }),
  place: one(places, {
    fields: [businessOwners.placeId],
    references: [places.id],
  }),
}));
