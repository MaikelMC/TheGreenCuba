import { pgTable, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { places } from "./places";
import { users } from "./users";

export const savedPlaces = pgTable(
  "saved_places",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userPlaceUnique: unique("saved_places_user_place_unique").on(table.userId, table.placeId),
    userIdx: index("saved_places_user_idx").on(table.userId),
    placeIdx: index("saved_places_place_idx").on(table.placeId),
  }),
);

export const savedPlaceRelations = relations(savedPlaces, ({ one }) => ({
  user: one(users, {
    fields: [savedPlaces.userId],
    references: [users.id],
  }),
  place: one(places, {
    fields: [savedPlaces.placeId],
    references: [places.id],
  }),
}));
