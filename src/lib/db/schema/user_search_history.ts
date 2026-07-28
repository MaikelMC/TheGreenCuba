import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const userSearchHistory = pgTable(
  "user_search_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    query: text("query").notNull(),
    type: text("type", { enum: ["natural_language", "keyword", "voice"] })
      .default("natural_language")
      .notNull(),
    resultsCount: text("results_count"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("search_history_user_idx").on(table.userId),
    userCreatedIdx: index("search_history_user_created_idx").on(table.userId, table.createdAt),
  }),
);

export const searchHistoryRelations = relations(userSearchHistory, ({ one }) => ({
  user: one(users, {
    fields: [userSearchHistory.userId],
    references: [users.id],
  }),
}));
