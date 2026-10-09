import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { places } from "./places";

/**
 * Una oferta flash de un negocio: un precio rebajado con fecha de caducidad.
 *
 * **La vigencia no se guarda**, se calcula. No hay columna `vigente` ni cron que
 * apague nada: una oferta está viva mientras `inicia <= now() < termina`, y eso
 * lo decide la consulta. Así una oferta que termina a las cinco deja de salir a
 * las cinco sin que nadie escriba nada —ni una fila que puede quedar en el
 * estado equivocado si la tarea que la apaga no corre—.
 *
 * `producto_id` apunta a una entrada del jsonb `places.menu` por su `id`, **no
 * por clave foránea**: la carta no vive en una tabla, vive ahí, y no hay fila
 * contra la que referenciar. Por eso el borrado de un producto no arrastra la
 * oferta: quien escribe la carta la limpia (ver `limpiarOfertas` en
 * `src/lib/ofertas.ts`).
 *
 * El tope de ofertas vivas a la vez lo pone el plan (`ofertas_vigentes_max`) y
 * lo comprueba la ruta al crear, no la base: es una regla comercial y cambia
 * con el catálogo de planes, que aquí no se conoce.
 */
export const ofertas = pgTable(
  "ofertas",
  {
    id: text("id").primaryKey(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),

    /** La entrada de `places.menu` a la que apunta. Ver el comentario de arriba. */
    productoId: text("producto_id").notNull(),

    titulo: text("titulo").notNull(),
    descripcion: text("descripcion"),

    /* El precio rebajado va como **texto**, igual que el precio de la carta: el
       dueño escribe «150» o «2.50» y se enseña tal cual, tachando el de la carta
       al lado. Guardarlo como número obligaría a elegir una moneda —que ya está
       en el producto— y a pelear con los precios de texto libre («3–5 USD») que
       la carta admite.

       Es **uno de los dos**: o precio rebajado o porcentaje, nunca los dos ni
       ninguno. Lo garantiza el `check` de abajo. */
    precioOferta: text("precio_oferta"),
    descuentoPct: integer("descuento_pct"),

    inicia: timestamp("inicia").notNull(),
    termina: timestamp("termina").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    /* El índice que respalda la única consulta que hay: las ofertas vivas de un
       negocio. Se ordena por `termina` porque el filtro pregunta por el
       intervalo, y de paso deja la más próxima a caducar delante. */
    negocioTerminaIdx: index("ofertas_negocio_termina_idx").on(
      table.negocioId,
      table.termina,
    ),
    /* Una oferta que termina antes de empezar no está viva nunca; sería una fila
       que se crea y no sale, sin ningún error que lo explique. */
    rangoCheck: check(
      "ofertas_rango_check",
      sql`${table.termina} > ${table.inicia}`,
    ),
    /* O precio rebajado o porcentaje. `num_nonnulls` cuenta los no nulos de la
       lista, así que esto exige exactamente uno de los dos. */
    rebajaCheck: check(
      "ofertas_rebaja_check",
      sql`num_nonnulls(${table.precioOferta}, ${table.descuentoPct}) = 1`,
    ),
    /* Un porcentaje de 0 no rebaja nada y uno de 100 regala el producto. */
    pctCheck: check(
      "ofertas_pct_check",
      sql`${table.descuentoPct} is null or (${table.descuentoPct} >= 1 and ${table.descuentoPct} <= 99)`,
    ),
  }),
);

export const ofertaRelations = relations(ofertas, ({ one }) => ({
  negocio: one(places, {
    fields: [ofertas.negocioId],
    references: [places.id],
  }),
}));
