import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, doublePrecision, index, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

export interface ProjectOfferPackage {
  id: string;
  title: string;
  price: string;
  includes: string[];
  capacity: number | null;
  conditions: string;
  validUntil: string;
}

export const projectRequests = pgTable(
  "project_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    contact: text("contact").notNull(),
    phones: text("phones").array().notNull(),
    socialLinks: text("social_links").array().notNull(),
    provinces: text("provinces").array().notNull(),
    venueName: text("venue_name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    offers: text("offers"),
    offerPackages: jsonb("offer_packages").$type<ProjectOfferPackage[]>().notNull().default(sql`'[]'::jsonb`),
    offerImageUrl: text("offer_image_url"),
    coverImageUrl: text("cover_image_url"),
    mapImageUrl: text("map_image_url"),
    imageUrls: text("image_urls").array().notNull().default(sql`'{}'::text[]`),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .default("pending")
      .notNull(),
    adminNote: text("admin_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdx: index("project_requests_user_idx").on(table.userId),
    statusIdx: index("project_requests_status_idx").on(table.status),
    createdIdx: index("project_requests_created_idx").on(table.createdAt),
  }),
);
