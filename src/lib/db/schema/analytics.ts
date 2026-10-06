import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Analítica interna de La Verde.
 *
 * Vive en la misma base Neon que el producto a propósito (`§4` del plan):
 * nada de Supabase, warehouses ni Redis. Dos tablas y nada más:
 *
 * - `analytics_events`: el evento crudo, pequeño y de vida corta (retención
 *   configurable, 90 días por defecto).
 * - `analytics_daily`: las agregaciones diarias que el dashboard consulta.
 *   Estas **no caducan**: borrar el crudo no puede llevarse el histórico.
 *
 * Lo que NO se guarda aquí: contraseñas, tokens, correos, teléfonos ni
 * contenido privado. Un evento se identifica por `user_id` y `session_id`, que
 * es lo mínimo para contar sin identificar personas.
 */

/**
 * Un evento de producto.
 *
 * **Sin claves foráneas a `users` ni a `places`, y es deliberado.** Un evento
 * no es contenido: tiene que sobrevivir a que se borre la cuenta o el negocio
 * —si no, borrar una ficha falsea el histórico—. Tampoco queremos la cascada
 * que arrastraría al borrar un usuario. Por eso `user_id` y `business_id` son
 * texto a secas, nullable, sin `references`.
 *
 * `dedupe_key` es la defensa contra el doble conteo (`§43`): cuando el emisor
 * puede construir una clave estable («view:<place>:<sesión>:<día>»), repetir la
 * escritura no suma. Es única y nullable; `null` —el caso normal— no colisiona
 * porque Postgres no compara los `null` bajo un índice único.
 *
 * Los índices se eligieron por las consultas reales del dashboard, no por
 * costumbre: casi todas filtran por `event_type` y un rango de fecha, así que el
 * compuesto `(event_type, created_at)` es el que trabaja. Los otros tres cubren
 * negocio, usuario y limpieza/periodo global.
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    /** Uno de `AnalyticsEventType` (`src/lib/analytics/events.ts`). */
    eventType: text("event_type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),

    /* Quién. `user_id` es de la tabla `users`; `session_id` lo genera el
       navegador y sobrevive a la sesión de auth —sirve para contar visitantes
       anónimos sin abrir una tabla de sesiones—. */
    userId: text("user_id"),
    sessionId: text("session_id"),

    /* Qué negocio, si el evento va sobre uno. */
    businessId: text("business_id"),

    /* Qué se buscó, si fue una búsqueda. Recortado al escribir (la ruta ya
       limita a 500), nunca el texto entero sin tope. */
    searchQuery: text("search_query"),
    categoryId: text("category_id"),
    province: text("province"),
    municipality: text("municipality"),
    resultCount: integer("result_count"),

    /* Atribución (§28). `referrer` es el dominio de origen, nunca la URL
       completa con parámetros: eso ya son datos de terceros innecesarios. */
    source: text("source"),
    medium: text("medium"),
    campaign: text("campaign"),
    referrer: text("referrer"),

    /** Solo cuando ninguno de los campos anteriores puede llevar el dato.
        No es un cajón de sastre: si algo se consulta, sube a columna. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    /** Clave de idempotencia opcional. Ver el comentario de arriba. */
    dedupeKey: text("dedupe_key"),
  },
  (table) => ({
    typeCreatedIdx: index("analytics_events_type_created_idx").on(
      table.eventType,
      table.createdAt,
    ),
    createdIdx: index("analytics_events_created_idx").on(table.createdAt),
    businessCreatedIdx: index("analytics_events_business_created_idx").on(
      table.businessId,
      table.createdAt,
    ),
    userCreatedIdx: index("analytics_events_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    dedupeKeyUnique: unique("analytics_events_dedupe_key_unique").on(
      table.dedupeKey,
    ),
  }),
);

/**
 * Agregación diaria. Es lo que el dashboard consulta para periodos pasados
 * (`§11`, `§12`, `§44`): pocos registros en vez de recorrer todo el histórico.
 *
 * **Las dimensiones vacías son `""`, no `null`, y no es un detalle.**
 * Postgres considera distintos todos los `null` bajo un índice único, así que
 * un `ON CONFLICT` sobre columnas nullable nunca casaría y cada reejecución
 * insertaría filas duplicadas. Con `""` como «desconocido» el upsert es
 * idempotente de verdad.
 *
 * Los contadores se **recalculan**, no se incrementan: agregar dos veces el
 * mismo día deja el mismo número, que es el requisito de `§13`.
 */
export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    id: text("id").primaryKey(),
    /** «YYYY-MM-DD» en UTC. Texto y no `date`: se compara y se filtra como
        cadena en todas las consultas del dashboard, sin conversiones. */
    day: text("day").notNull(),

    /* Dimensiones. `""` = desconocido. */
    province: text("province").notNull().default(""),
    municipality: text("municipality").notNull().default(""),
    categoryId: text("category_id").notNull().default(""),

    /* Métricas. Todas `integer`: a corto plazo ninguna llega a 2.147 millones
       y el driver entrega `bigint` como cadena. */
    searches: integer("searches").notNull().default(0),
    successfulSearches: integer("successful_searches").notNull().default(0),
    noResultSearches: integer("no_result_searches").notNull().default(0),
    businessViews: integer("business_views").notNull().default(0),
    businessImpressions: integer("business_impressions").notNull().default(0),
    businessActions: integer("business_actions").notNull().default(0),
    newUsers: integer("new_users").notNull().default(0),
    activeUsers: integer("active_users").notNull().default(0),
    newBusinesses: integer("new_businesses").notNull().default(0),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    /* La clave de idempotencia del upsert: un registro por día y combinación
       de dimensiones. */
    dimUnique: unique("analytics_daily_dim_unique").on(
      table.day,
      table.province,
      table.municipality,
      table.categoryId,
    ),
    /* El dashboard casi siempre filtra por rango de días y agrupa el resto:
       con el compuesto sobra para el «últimos 30 días». */
    dayIdx: index("analytics_daily_day_idx").on(table.day),
  }),
);
