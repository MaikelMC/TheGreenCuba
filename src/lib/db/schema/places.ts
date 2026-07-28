import {
  pgTable,
  text,
  doublePrecision,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { categories } from "./categories";
import { users } from "./users";

export const places = pgTable(
  "places",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    shortDescription: text("short_description"),

    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),

    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),

    address: text("address"),
    city: text("city").notNull(),
    province: text("province").notNull(),
    neighborhood: text("neighborhood"),

    phone: text("phone"),
    website: text("website"),
    // denormalized hours JSON for quick reads
    hoursJson: jsonb("hours_json").$type<Record<string, { open: string; close: string } | null>>(),

    paymentMethods: text("payment_methods").array(),
    currencies: text("currencies").array(),
    priceLevel: integer("price_level").default(1),

    vibe: text("vibe").array(),
    tags: text("tags").array(),

    isActive: boolean("is_active").default(true).notNull(),
    isBoosted: boolean("is_boosted").default(false).notNull(),
    boostExpiresAt: timestamp("boost_expires_at"),
    status: text("status", { enum: ["active", "closed", "temporary_closed"] })
      .default("active")
      .notNull(),

    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    slugIdx: index("places_slug_idx").on(table.slug),
    categoryIdx: index("places_category_idx").on(table.categoryId),
    cityIdx: index("places_city_idx").on(table.city),
    coordsIdx: index("places_coords_idx").on(table.lat, table.lng),
    activeIdx: index("places_active_idx").on(table.isActive),
    boostedIdx: index("places_boosted_idx").on(table.isBoosted),
  }),
);

export const placeRelations = relations(places, ({ one, many }) => ({
  category: one(categories, {
    fields: [places.categoryId],
    references: [categories.id],
  }),
  images: many(placeImages),
  hours: many(placeHours),
  menuItems: many(placeMenuItems),
  reviews: many(reviews),
  savedBy: many(savedPlaces),
  businessOwners: many(businessOwners),
  createdByUser: one(users, {
    fields: [places.createdBy],
    references: [users.id],
  }),
}));

import { placeImages } from "./place_images";
import { placeHours } from "./place_hours";
import { placeMenuItems } from "./place_menu_items";
import { reviews } from "./reviews";
import { savedPlaces } from "./saved_places";
import { businessOwners } from "./business_owners";
