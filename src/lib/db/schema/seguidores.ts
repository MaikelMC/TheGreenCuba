import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { places } from "./places";

/**
 * Quién quiere que le avisen: un seguidor de un negocio, con su canal y su
 * consentimiento.
 *
 * **La Verde no guarda a nadie sin que lo haya pedido dos veces.** El botón de
 * la ficha lleva al bot, y el alta ocurre cuando la persona pulsa «Iniciar» en
 * Telegram: eso es lo que se sella en `consentimiento_en` —la fecha del
 * consentimiento explícito—. Antes de eso no hay fila.
 *
 * `destino` es a dónde se manda: hoy, el `chat_id` de Telegram. Es una
 * dirección técnica, no un nombre ni un teléfono: el negocio ve el **número** de
 * seguidores, no quiénes son, y la baja no deja rastro más allá de la fecha.
 *
 * `baja_en` **no borra la fila**, la apaga. Es lo que hace que volver a pulsar
 * «Iniciar» sea barato —se rellena `consentimiento_en` y se vacía `baja_en`— y
 * lo que evita que alguien dado de baja reciba un aviso por una fila duplicada.
 * Solo `avisarSeguidores` mira esta columna.
 *
 * **Sin clave foránea al usuario**: quien sigue un negocio casi nunca tiene
 * cuenta —es gente que abre un enlace de WhatsApp—, así que no hay `user_id` al
 * que apuntar. La relación es con el negocio y con un chat, y nada más.
 */
export const seguidores = pgTable(
  "seguidores",
  {
    id: text("id").primaryKey(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    /* Una sola cadena por ahora: `telegram`. La columna existe para que el día
       que entre otro canal (WhatsApp, que hoy no tiene API de envío) no haya que
       migrar la tabla para distinguirlos. */
    canal: text("canal", { enum: ["telegram"] }).notNull(),
    /** El `chat_id` de Telegram, tal como lo devuelve la API. */
    destino: text("destino").notNull(),

    /** Cuándo dio el consentimiento. Se reescribe al volver tras una baja. */
    consentimientoEn: timestamp("consentimiento_en").notNull(),
    /** Cuándo se dio de baja. `null` = sigue siguiendo al negocio. */
    bajaEn: timestamp("baja_en"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    /* La clave del upsert del alta y del `/baja`: una fila por negocio, canal y
       chat. Sin ella, volver a pulsar «Iniciar» crearían una fila nueva y el
       negocio contaría dos veces a la misma persona. */
    claveUnique: unique("seguidores_clave_unique").on(
      table.negocioId,
      table.canal,
      table.destino,
    ),
    /* El índice de la lectura que hay: los seguidores vivos de un negocio, que
       es lo que recorre el envío por lotes. */
    negocioIdx: index("seguidores_negocio_idx").on(table.negocioId, table.bajaEn),
    /* El `/baja` no sabe de negocios: solo tiene un `chat_id` y da de baja todo
       lo que ese chat sigue. Sin este índice, esa consulta recorre la tabla. */
    destinoIdx: index("seguidores_destino_idx").on(table.canal, table.destino),
  }),
);

/**
 * Un aviso ya enviado, y **el contador del tope semanal**.
 *
 * Una fila por aviso entregado (o intentado con al menos un destinatario), con
 * la semana ISO en la que salió. El tope —tres por semana y negocio— se
 * comprueba contando las filas de la semana, no con un contador que hay que
 * reiniciar: igual que la plaza de las publicaciones, la clave es el periodo y
 * el lunes siguiente no hay nada que limpiar.
 *
 * No se guarda **qué** se mandó —el texto vive en el evento que lo disparó—:
 * esto es la cuenta del envío, y `enviados`/`fallidos` es lo que permite decir
 * «llegó a 12 de 14» sin deducirlo de ninguna otra tabla.
 */
export const avisosSeguidores = pgTable(
  "avisos_seguidores",
  {
    id: text("id").primaryKey(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    /** La semana ISO del envío, `"2026-W41"`. Ver `semanaDe` en `publicaciones.ts`. */
    semana: text("semana").notNull(),
    /** Para qué salió: el titular, que es lo que el dueño reconoce. */
    titulo: text("titulo").notNull(),

    /** Cuántos mensajes aceptó Telegram. */
    enviados: integer("enviados").notNull().default(0),
    /**
     * Cuántos rebotaron —bot bloqueado, chat borrado—. Los rebotados se dan de
     * baja solos, así que esto es «cuántos se pierden por el camino», no un
     * error que haya que reintentar.
     */
    fallidos: integer("fallidos").notNull().default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    /* La lectura del tope: los avisos de un negocio en una semana. */
    negocioSemanaIdx: index("avisos_seguidores_negocio_semana_idx").on(
      table.negocioId,
      table.semana,
    ),
  }),
);
