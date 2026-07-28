import { pgTable, text, integer, boolean, time, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { places } from "./places";

export const placeHours = pgTable(
  "place_hours",
  {
    id: text("id").primaryKey(),
    placeId: text("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 1=Monday ...
    openTime: time("open_time"),
    closeTime: time("close_time"),
    isClosed: boolean("is_closed").default(false).notNull(),
  },
  (table) => ({
    placeDayUnique: unique("place_hours_place_day_unique").on(table.placeId, table.dayOfWeek),
    placeIdx: index("place_hours_place_idx").on(table.placeId),
  }),
);

export const placeHourRelations = relations(placeHours, ({ one }) => ({
  place: one(places, {
    fields: [placeHours.placeId],
    references: [places.id],
  }),
}));
