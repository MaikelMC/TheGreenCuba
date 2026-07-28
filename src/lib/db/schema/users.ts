import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    clerkId: text("clerk_id").notNull().unique(),
    email: text("email").notNull(),
    name: text("name"),
    imageUrl: text("image_url"),
    locationCity: text("location_city"),
    locationLat: text("location_lat"),
    locationLng: text("location_lng"),
    onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
    preferences: jsonb("preferences").$type<{
      interests?: string[];
      currencies?: string[];
      moods?: string[];
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    clerkIdIdx: index("users_clerk_id_idx").on(table.clerkId),
    emailIdx: index("users_email_idx").on(table.email),
  }),
);

export const userRelations = relations(users, ({ many }) => ({
  savedPlaces: many(savedPlaces),
  reviews: many(reviews),
  businessOwners: many(businessOwners),
}));

import { savedPlaces } from "./saved_places";
import { reviews } from "./reviews";
import { businessOwners } from "./business_owners";
