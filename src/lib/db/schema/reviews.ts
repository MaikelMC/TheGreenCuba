import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { places } from "./places";
import { users } from "./users";

export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    content: text("content"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    placeIdx: index("reviews_place_idx").on(table.placeId),
    userIdx: index("reviews_user_idx").on(table.userId),
    placeUserUnique: index("reviews_place_user_idx").on(table.placeId, table.userId),
  }),
);

export const reviewRelations = relations(reviews, ({ one }) => ({
  place: one(places, {
    fields: [reviews.placeId],
    references: [places.id],
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
}));
