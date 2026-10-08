import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  unique,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * Estadísticas del negocio: lo que alimenta la sección de visitas del panel.
 *
 * Es una tabla **aparte** de `analytics_events`/`analytics_daily` a propósito.
 * Aquellas miden el producto entero —búsquedas, altas, embudo—; estas cuentan
 * gestos de **una** ficha y los enseña a su dueño. Mezclarlas obligaría a que el
 * panel del negocio filtrara y agregara sobre la tabla cruda del producto en
 * cada apertura.
 *
 * Dos tablas y ninguna más:
 *
 * - `eventos_diarios`: el agregado. Es lo **único** que lee el panel.
 * - `eventos_unicos`: la valla del dedupe. Una fila por visitante y día, para
 *   poder decir «cuántos distintos» sin guardar el histórico de nadie.
 *
 * **Sin clave foránea a `places`.** Un evento no es contenido: tiene que
 * sobrevivir a que se borre el negocio —si no, borrarlo falsearía el histórico—
 * y no queremos arrastrar la cascada.
 */

/**
 * Un día de eventos, agregado por tipo.
 *
 * **Las dimensiones vacías son `""`, no `null`,** por lo mismo que en
 * `analytics_daily`: Postgres considera distintos todos los `null` bajo un
 * índice único, así que un `ON CONFLICT` sobre columnas nullable nunca casaría y
 * cada reejecución insertaría una fila nueva. Con `""` como «sin dimensión» el
 * upsert es idempotente de verdad.
 *
 * `dimension` lleva el sub-dato de un tipo que lo necesite. Hoy solo lo usa
 * `producto_visto`, donde guarda el **nombre** del producto: es lo que permite
 * el «top 5 productos» sin abrir la carta ni cargar con una clave foránea a
 * `place_menu_items` —que además se reescribe en cada guardado del dueño—. El
 * precio de usar el nombre es que renombrar un producto parte su cuenta en dos;
 * se acepta por lo que cuesta lo contrario.
 *
 * `fecha` es texto «YYYY-MM-DD» en UTC y no `date`: se compara y se filtra como
 * cadena en todas las consultas, sin conversiones.
 */
export const eventosDiarios = pgTable(
  "eventos_diarios",
  {
    id: text("id").primaryKey(),
    negocioId: text("negocio_id").notNull(),
    /** «YYYY-MM-DD» en UTC. */
    fecha: text("fecha").notNull(),
    /** Uno de `TipoEvento` (`src/lib/eventos.ts`). Texto sin validar en la base:
        el catálogo vive en el código y crece sin migración. */
    tipo: text("tipo").notNull(),
    /** Sub-dato del evento. `""` = sin él. Ver el comentario de arriba. */
    dimension: text("dimension").notNull().default(""),

    /** Veces que ocurrió, repetido el visitante o no. */
    conteo: integer("conteo").notNull().default(0),
    /** Visitantes distintos ese día. */
    unicos: integer("unicos").notNull().default(0),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    /* La clave del upsert: una fila por negocio, día, tipo y dimensión. */
    claveUnique: unique("eventos_diarios_clave_unique").on(
      table.negocioId,
      table.fecha,
      table.tipo,
      table.dimension,
    ),
    /* El panel casi siempre pide un rango de días de un negocio: con esto el
       «este mes» y el «últimos 30 días» no recorren la tabla entera. */
    negocioFechaIdx: index("eventos_diarios_negocio_fecha_idx").on(
      table.negocioId,
      table.fecha,
    ),
  }),
);

/**
 * La valla del dedupe: una fila por visitante, día, tipo y dimensión.
 *
 * Es lo que permite mantener `unicos` sin guardar una tabla de sesiones. La
 * clave es el hash **diario** del visitante, así que al día siguiente la misma
 * persona vuelve a contar como única y la fila de ayer ya no sirve para
 * reconocerla. No hay id: la clave compuesta es la clave primaria y el
 * `onConflictDoNothing` se apoya en ella.
 */
export const eventosUnicos = pgTable(
  "eventos_unicos",
  {
    negocioId: text("negocio_id").notNull(),
    fecha: text("fecha").notNull(),
    tipo: text("tipo").notNull(),
    dimension: text("dimension").notNull().default(""),
    /** Hash de la cookie anónima. No identifica a nadie: ver el route handler. */
    visitante: text("visitante").notNull(),
  },
  (table) => ({
    clave: primaryKey({
      columns: [
        table.negocioId,
        table.fecha,
        table.tipo,
        table.dimension,
        table.visitante,
      ],
    }),
  }),
);
