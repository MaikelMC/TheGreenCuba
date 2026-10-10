import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  check,
  unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { places } from "./places";

/**
 * Una publicación de Facebook a medias: el texto (y el flyer, si lo hay) que el
 * negocio quiere postear en un grupo, ya redactado y en cola.
 *
 * **La publicación no se hace sola.** Facebook no permite publicar en grupos
 * por API sin arriesgar el bloqueo de la cuenta, así que esto es una **cola
 * asistida**: aquí vive el texto y la imagen, y alguien —la administración—
 * copia el texto, descarga la imagen y lo postea a mano. `estado: publicada` y
 * `enlace` son el registro de que se hizo, no algo que el sistema provoque.
 *
 * `semana` es la **clave de la semana ISO 8601** («2026-W41»), calculada al
 * encolar y no recalculada después: es lo que cuenta el tope del plan
 * (`publicaciones_semana`, Básico 1 / Pro 3). Se guarda como texto y no como
 * fecha porque lo que hace falta es una clave estable de agrupación, no un
 * instante —así el recuento es una igualdad y no un rango de fechas que hay que
 * acertar con husos—. Ver `semanaDe` en `src/lib/publicaciones.ts`.
 *
 * `estado` recorre `borrador → lista → publicada`. Un borrador se sigue
 * editando, una lista está para copiar y postear, y publicada solo se marca con
 * el enlace del post delante.
 *
 * El tope lo comprueba la ruta al crear, no la base: es una regla comercial que
 * cambia con el catálogo de planes, que aquí no se conoce. Ver `limite` en
 * `src/lib/plans-server.ts`.
 */
export const publicaciones = pgTable(
  "publicaciones",
  {
    id: text("id").primaryKey(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),

    /** El texto del post, ya redactado (a mano o con IA). */
    texto: text("texto").notNull(),

    /** URL del flyer adjunto, en el bucket o donde sea que viva la imagen. */
    imagenUrl: text("imagen_url"),

    estado: text("estado", { enum: ["borrador", "lista", "publicada"] })
      .default("borrador")
      .notNull(),

    /**
     * Semana ISO 8601 del encolado («2026-W41»). Es la clave con la que se
     * cuenta el tope semanal del plan.
     */
    semana: text("semana").notNull(),

    /**
     * La plaza que ocupa dentro de su semana, en `[0, tope)`.
     *
     * **Es lo que cierra la carrera del tope.** El recuento —«¿cuántas hay ya?»—
     * y el alta son dos viajes a la base, y dos peticiones a la vez leen el
     * mismo número y las dos pasan. El índice `unique` de abajo hace que la plaza
     * sea de uno solo: quien llega segundo choca y no entra, en vez de colarse.
     *
     * **Plaza y no número de orden**: un hueco que deja un borrado se reutiliza
     * —con dos filas y una borrada, «hay 1» diría que cabe otra en la plaza 1,
     * que ya está—. Ver el libre por el que pregunta la ruta en `POST`.
     */
    orden: integer("orden").notNull(),

    /** Enlace del post una vez publicado. Obligatorio al marcar `publicada`. */
    enlace: text("enlace"),
    /** Cuándo se marcó como publicada. `null` mientras no lo esté. */
    publicadaEn: timestamp("publicada_en"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    /* El único acceso por negocio es el recuento semanal del tope, y ese filtra
       por las dos columnas: negocio **y** semana. El compuesto cubre los dos
       casos y el índice suelto por negocio sería su prefijo. */
    negocioSemanaIdx: index("publicaciones_negocio_semana_idx").on(
      table.negocioId,
      table.semana,
    ),
    /* Solo los tres estados. Drizzle no genera un `check` al declarar `text`
       con `enum`, así que sin esto la columna aceptaría cualquier cadena. */
    estadoCheck: check(
      "publicaciones_estado_check",
      sql`${table.estado} in ('borrador', 'lista', 'publicada')`,
    ),
    /* Publicada sin enlace no vale: marcar el post como hecho es afirmar que
       existe en algún sitio, y el enlace es la prueba. Dejar el estado sin la
       URL convierte la cola en una promesa que nadie puede comprobar. */
    enlaceCheck: check(
      "publicaciones_enlace_check",
      sql`${table.estado} <> 'publicada' or ${table.enlace} is not null`,
    ),
    /* El tope del plan, impuesto por la base y no por el recuento de la ruta.
       Dos altas a la vez por la misma plaza no pueden cuajar: la segunda choca
       aquí y la ruta lo traduce a un 409. Ver la columna `orden`. */
    negocioSemanaOrdenUnique: unique(
      "publicaciones_negocio_semana_orden_unique",
    ).on(table.negocioId, table.semana, table.orden),
  }),
);

export const publicacionRelations = relations(publicaciones, ({ one }) => ({
  negocio: one(places, {
    fields: [publicaciones.negocioId],
    references: [places.id],
  }),
}));
