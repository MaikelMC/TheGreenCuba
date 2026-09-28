import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { places } from "./places";

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    /* Remitente visible para los avisos de administración («Support La
       Verde»). Nulo en las notificaciones del sistema: nadie las firmó. */
    senderName: text("sender_name"),
    placeId: text("place_id").references(() => places.id, { onDelete: "set null" }),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index("notifications_user_created_idx").on(table.userId, table.createdAt),
  }),
);