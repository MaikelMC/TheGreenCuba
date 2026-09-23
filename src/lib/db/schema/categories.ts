import { pgTable, text, integer } from "drizzle-orm/pg-core";
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
  /* Sin índices propios: `slug` ya es único y el índice único que lo respalda
     cubre la búsqueda por slug, que es la única que se hace contra esta tabla
     (`findCategoryBySlug`, `categorySlugTaken`). El apoyo que había encima era
     el mismo índice otra vez. */
);

export const categoryRelations = relations(categories, ({ many }) => ({
  places: many(places),
}));

import { places } from "./places";
