import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

/**
 * Tickets de soporte: las quejas que un usuario formula cuando detecta un
 * error, acumuladas para que administración las atienda desde el panel.
 *
 * Sin relación con `places`: un ticket nace de una pantalla rota o de una
 * duda, no de un negocio concreto. Si algún día hace falta vincularlo,
 * `meta jsonb` trae el contexto (ruta donde pasó, etc.) y alcanza.
 *
 * El correo va **copia** y no referencia: el usuario puede borrar su cuenta
 * (`onDelete: set null` en `userId`) y el ticket debe seguir legible para el
 * que lo atiende. Es el mismo motivo por el que el alta guarda el nombre
 * aparte en `userSnapshot`.
 *
 * `status` sigue el ciclo de vida de cualquier mesa de ayuda: `open` entra,
 * `in_progress` alguien lo mira, `resolved` se contestó, `closed` se archiva
 * sin respuesta.
 */
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: text("id").primaryKey(),
    /** `null` cuando quien reporta no tiene sesión abierta. */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Copia plana para que el ticket sobreviva al borrado de la cuenta. */
    email: text("email").notNull(),
    /** Nombre y correo al momento de crear el ticket, para enseñarlo sin join. */
    userSnapshot: jsonb("user_snapshot").$type<{ name: string | null; email: string }>(),

    subject: text("subject").notNull(),
    message: text("message").notNull(),

    /** Donde pasó: la ruta de la app desde la que se reportó. Orienta al que
        atiende sin tener que preguntar «¿en qué pantalla?». */
    pagePath: text("page_path"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),

    status: text("status", { enum: ["open", "in_progress", "resolved", "closed"] })
      .default("open")
      .notNull(),
    /** Respuesta de administración; su envío por correo lo registra `repliedAt`. */
    adminReply: text("admin_reply"),
    repliedAt: timestamp("replied_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    statusCreatedIdx: index("support_tickets_status_created_idx").on(table.status, table.createdAt),
  }),
);

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
}));
