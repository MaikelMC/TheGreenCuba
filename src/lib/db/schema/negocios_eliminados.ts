/**
 * Tabla de auditoría para negocios que salen del catálogo público.
 *
 * La llena un trigger AFTER de Postgres (ver migración 0053) que se dispara
 * cuando un place pasa a `is_active = false` o `review_status != 'approved'`.
 * El endpoint `/api/negocios/provincia/[provincia]/cambios` la consulta para
 * decirle al cliente qué ids borrar de IndexedDB.
 *
 * No se usa drizzle para escribir aquí: solo el trigger. La tabla es de solo
 * lectura desde la app.
 */

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const negociosEliminados = pgTable("negocios_eliminados", {
  placeId: text("place_id").primaryKey(),
  eliminadoEn: timestamp("eliminado_en").defaultNow().notNull(),
});
