import { pgTable, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { places } from "./places";

export const placeImages = pgTable(
  "place_images",
  {
    id: text("id").primaryKey(),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    width: integer("width"),
    height: integer("height"),
    isCover: boolean("is_cover").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    placeIdx: index("place_images_place_idx").on(table.placeId),
    coverIdx: index("place_images_cover_idx").on(table.placeId, table.isCover),
  }),
);

export const placeImageRelations = relations(placeImages, ({ one }) => ({
  place: one(places, {
    fields: [placeImages.placeId],
    references: [places.id],
  }),
}));
