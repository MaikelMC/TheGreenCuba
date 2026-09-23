import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
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
    /* `integer` y no `text`: cuenta resultados, y como cadena ordena y compara
       alfabéticamente («9» > «10»). */
    resultsCount: integer("results_count"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    /* Uno solo, y con las dos columnas. El índice por `user_id` a secas era un
       prefijo de este: Postgres usa el compuesto para cualquier consulta que
       empiece por `user_id`, así que tener los dos no compraba nada y se pagaba
       dos veces en cada `insert`. */
    userCreatedIdx: index("search_history_user_created_idx").on(table.userId, table.createdAt),
  }),
);

export const searchHistoryRelations = relations(userSearchHistory, ({ one }) => ({
  user: one(users, {
    fields: [userSearchHistory.userId],
    references: [users.id],
  }),
}));
