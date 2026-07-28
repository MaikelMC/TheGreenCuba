import { pgTable, text, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    icon: text("icon"),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => ({
    slugIdx: index("categories_slug_idx").on(table.slug),
  }),
);

export const categoryRelations = relations(categories, ({ many }) => ({
  places: many(places),
}));

import { places } from "./places";
