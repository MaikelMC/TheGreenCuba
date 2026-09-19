import { pgTable, text, integer, timestamp, index, unique, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
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
    /* `unique` y no `index`: con un índice normal nada impide que el mismo
       usuario puntúe el mismo lugar cien veces. El nombre ya decía que era
       único; la declaración no lo era. */
    placeUserUnique: unique("reviews_place_user_unique").on(table.placeId, table.userId),
    /* Sin esto entra un rating de 0 o de 900: la columna es un `integer` sin
       más límite que el del tipo. */
    ratingRange: check("reviews_rating_range", sql`${table.rating} between 1 and 5`),
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
