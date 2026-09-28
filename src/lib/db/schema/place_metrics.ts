import { pgTable, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { places } from "./places";

/**
 * Métricas de negocio: los contadores que el dashboard de administración
 * necesita para "Negocios top".
 *
 * Un solo acumulador por negocio y no una tabla de eventos: el dashboard enseña
 * ranking, no analítica fina. La analítica fina ya la lleva PostHog (eventos
 * `place_viewed`, `route_requested`...); esto es el resumen que la app puede
 * consultar sin salir de su base.
 *
 * Los contadores son `integer` y no `bigint`: a corto plazo ningún negocio
 * llega a 2.147 millones de vistas y el driver entrega `bigint` como cadena,
 * con el cast que eso exige en cada lectura.
 *
 * `meta jsonb` guarda detalles puntuales (de dónde vino el evento) sin
 * ensanchar la tabla por cada caso nuevo.
 *
 * La fila se crea al primer evento (`onConflictDoUpdate`) y no con el negocio:
 * así las fichas sin tráfico no llenan la tabla de ceros.
 */
export const placeMetrics = pgTable(
  "place_metrics",
  {
    id: text("id").primaryKey(),
    placeId: text("place_id")
      .notNull()
      .unique()
      .references(() => places.id, { onDelete: "cascade" }),

    /** Veces que se abrió la ficha del negocio. */
    views: integer("views").notNull().default(0),
    /** Veces que se tocó su pin en el mapa. */
    mapClicks: integer("map_clicks").notNull().default(0),
    /** Veces que se pidió una ruta hasta el negocio ("Cómo llegar"). */
    routeRequests: integer("route_requests").notNull().default(0),
    /** Veces que la búsqueda IA lo eligió como resultado. */
    aiMatches: integer("ai_matches").notNull().default(0),
    /** Veces que alguien lo guardó en favoritos. */
    saves: integer("saves").notNull().default(0),
    /** Veces que se compartió su ficha. */
    shares: integer("shares").notNull().default(0),

    meta: jsonb("meta").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    /* El dashboard ordena por la suma de los contadores: sin índice, Postgres
       haría el cálculo completo y ordenaría en memoria en cada apertura. */
    viewsIdx: index("place_metrics_views_idx").on(table.views),
  }),
);
