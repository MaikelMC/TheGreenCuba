import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

/**
 * El registro de quién hizo qué en el panel de administración.
 *
 * Cada acción que cambia datos —aprobar, rechazar, cambiar un plan, confirmar
 * un pago, enviar un aviso, quitar un rol— deja una fila aquí. Es la respuesta
 * a «¿y esto quién lo tocó?» sin tener que reconstruirlo cruzando tablas que
 * solo guardan el estado final.
 *
 * `adminId` es la referencia viva y `adminNombre` la copia plana: igual que en
 * `support_tickets`, borrar la cuenta de un administrador no puede vaciar el
 * historial, así que el nombre sobrevive aunque la fila de `users` desaparezca
 * (`set null`). Las acciones automáticas —el webhook de QvaPay, un envío
 * programado— entran con `adminId = null` y el nombre «Sistema».
 *
 * `datos` guarda el contexto útil y **nunca secretos**: el estado anterior y el
 * nuevo, el número de destinatarios, el motivo de un rechazo. Lo que se pinta
 * siempre es `resumen`, que está escrito para leerse tal cual.
 *
 * El objeto (`objeto_tipo` + `objeto_id`) es una pareja de texto y no una clave
 * foránea polimórfica: apunta a negocios, suscripciones, publicaciones, tickets
 * o usuarios, y una FK por cada tipo obligaría a una columna por tabla. El
 * índice compuesto sirve para «la historia de este negocio».
 */
export const adminActividad = pgTable(
  "admin_actividad",
  {
    id: text("id").primaryKey(),
    /** `null` cuando la acción la hizo el sistema o una clave de administración. */
    adminId: text("admin_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Nombre al momento de la acción, para que sobreviva al borrado de la cuenta. */
    adminNombre: text("admin_nombre").notNull(),
    /** Clave corta y estable de la acción: `aprobar_solicitud`, `confirmar_pago`… */
    accion: text("accion").notNull(),
    /** Tipo de objeto tocado: `negocio`, `publicacion`, `usuario`, `sistema`… */
    objetoTipo: text("objeto_tipo").notNull(),
    objetoId: text("objeto_id"),
    /** Frase legible, la que se pinta en la lista: «Aprobó la ficha de El Palmar». */
    resumen: text("resumen").notNull(),
    /** Contexto sin secretos. `null` cuando no aporta nada. */
    datos: jsonb("datos").$type<Record<string, unknown>>(),
    creadoEn: timestamp("creado_en").defaultNow().notNull(),
  },
  (table) => ({
    /* La lista de Actividad ordena por fecha y recorta por rango. */
    fechaIdx: index("admin_actividad_fecha_idx").on(table.creadoEn),
    /* «Qué hizo este administrador» y «la historia de este objeto». */
    adminIdx: index("admin_actividad_admin_idx").on(
      table.adminId,
      table.creadoEn,
    ),
    objetoIdx: index("admin_actividad_objeto_idx").on(
      table.objetoTipo,
      table.objetoId,
    ),
  }),
);

export const adminActividadRelations = relations(adminActividad, ({ one }) => ({
  admin: one(users, {
    fields: [adminActividad.adminId],
    references: [users.id],
  }),
}));
