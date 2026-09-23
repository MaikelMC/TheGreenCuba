import { pgTable, text, doublePrecision, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { places } from "./places";

export const placeMenuItems = pgTable(
  "place_menu_items",
  {
    id: text("id").primaryKey(),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    price: doublePrecision("price"),
    currency: text("currency", { enum: ["MLC", "CUP", "USD", "EUR"] }).default("MLC"),
    imageUrl: text("image_url"),
    tag: text("tag", { enum: ["popular", "new", "offer"] }),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    /* Uno solo, con las dos columnas. El de `place_id` a secas era su prefijo;
       el menú siempre se pide por negocio y a veces filtrando los activos, y
       las dos formas las resuelve el compuesto. */
    activeIdx: index("menu_items_active_idx").on(table.placeId, table.isActive),
  }),
);

export const placeMenuItemRelations = relations(placeMenuItems, ({ one }) => ({
  place: one(places, {
    fields: [placeMenuItems.placeId],
    references: [places.id],
  }),
}));
