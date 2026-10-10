import {
  pgTable,
  text,
  integer,
  timestamp,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { places } from "./places";

/**
 * El «Top del mes»: los tres negocios con más visitas únicas de cada
 * categoría y municipio, ya calculados y helados.
 *
 * **Es una foto, no una vista.** Se recalcula una vez al mes con
 * `src/lib/ranking-server.ts` y nadie más escribe aquí. Guardar el resultado
 * —en vez de calcularlo al leer— es lo que permite dos cosas que una consulta
 * en vivo no daría: que el premio (el descuento) sea auditable al cabo del
 * tiempo, y que la ficha sepa que un negocio ganó **ese** mes aunque este mes
 * vaya flojo.
 *
 * `categoria` guarda el **slug** y `municipio` la ciudad, denormalizados a
 * propósito: el ranking de septiembre tiene que seguir diciendo lo que decía
 * aunque el negocio cambie de categoría en octubre. La fila es un hecho
 * histórico, no una clave foránea a la ficha de hoy.
 *
 * `negocio_id` sí es clave foránea con `cascade`: sin el negocio no hay puesto
 * que enseñar, y una fila huérfana solo daría un enlace roto en `/ranking`.
 *
 * La escriben y la leen `src/lib/ranking-server.ts` (el job) y la página
 * pública `/ranking`; el índice `exists` de `queries.ts` es lo que enciende la
 * insignia en la ficha y en la tarjeta.
 */
export const rankingMensual = pgTable(
  "ranking_mensual",
  {
    id: text("id").primaryKey(),
    /** Mes al que corresponde el ranking, «YYYY-MM» en UTC. */
    periodo: text("periodo").notNull(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    /** Slug de la categoría (`categories.slug`). Ver el comentario de arriba. */
    categoria: text("categoria").notNull(),
    /** Municipio (`places.city`) donde compitió. */
    municipio: text("municipio").notNull(),
    /** 1 a 3. El mismo `check` de abajo lo acota. */
    posicion: integer("posicion").notNull(),
    /** Visitas únicas contadas ese mes. Es el número por el que se ordenó. */
    visitas: integer("visitas").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    /* Un negocio no puede salir dos veces en el mismo grupo del mismo mes. */
    puestoUnique: unique("ranking_mensual_puesto_unique").on(
      table.periodo,
      table.categoria,
      table.municipio,
      table.negocioId,
    ),
    /* La consulta de `/ranking`: un periodo entero, ya ordenado por grupo. */
    grupoIdx: index("ranking_mensual_grupo_idx").on(
      table.periodo,
      table.categoria,
      table.municipio,
    ),
    /* El top es de tres: una cuarta posición sería un error del cálculo, no un
       dato que valga la pena guardar. */
    posicionCheck: check(
      "ranking_mensual_posicion_check",
      sql`${table.posicion} >= 1 and ${table.posicion} <= 3`,
    ),
  }),
);

export const rankingRelations = relations(rankingMensual, ({ one }) => ({
  negocio: one(places, {
    fields: [rankingMensual.negocioId],
    references: [places.id],
  }),
}));
