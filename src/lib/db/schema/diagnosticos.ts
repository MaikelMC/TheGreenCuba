import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

/**
 * Diagnósticos de cliente para detectar problemas del mapa en teléfonos reales.
 *
 * Sin datos personales: no hay userId, no hay ubicación, no hay IP en claro.
 * El endpoint guarda solo el hash de la IP en memoria para el rate limit;
 * la tabla no lo recibe.
 *
 * Tipos válidos: navegador, error, mapa_cargado, mapa_lento, mapa_error,
 * mapa_abandonado. El endpoint los valida antes de insertar.
 *
 * Retención: 30 días. La limpieza corre al insertar, como mucho una vez al día.
 */
export const diagnosticos = pgTable(
  "diagnosticos",
  {
    id: text("id").primaryKey(),
    tipo: text("tipo").notNull(),
    datos: jsonb("datos").$type<Record<string, unknown>>().notNull(),
    creadoEn: timestamp("creado_en").defaultNow().notNull(),
  },
  (table) => ({
    tipoIdx: index("diagnosticos_tipo_idx").on(table.tipo),
    creadoEnIdx: index("diagnosticos_creado_en_idx").on(table.creadoEn),
  }),
);
