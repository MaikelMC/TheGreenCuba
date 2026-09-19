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
    /** Emoji de la categoría. El catálogo del cliente lo usa en las tarjetas
        donde no cabe un icono de Lucide. */
    emoji: text("emoji"),
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
