import {
  pgTable,
  text,
  bigint,
  integer,
  jsonb,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { places } from "./places";

/**
 * El asistente de Telegram: quién puede escribirle, qué le pidió y qué hizo.
 *
 * Son cuatro tablas y cada una responde a una pregunta distinta:
 *
 * - `telegram_updates` responde «¿ya vi este mensaje?». Telegram reintenta un
 *   update hasta que le contestas 200, así que sin esta valla un «se acabó el
 *   pan» se aplicaría dos veces.
 * - `telegram_vinculos` responde «¿de qué negocio me están hablando?». **Es la
 *   única fuente del negocio**: nunca se toma del texto del usuario ni de lo que
 *   diga el modelo, y por eso un chat solo puede estar vinculado a uno.
 * - `asistente_codigos` responde «¿cómo se demuestra que este chat es del
 *   dueño?» con un código de un solo uso que caduca en minutos.
 * - `asistente_log` responde «¿qué cambió y cómo lo deshago?». Es la memoria de
 *   los botones «Deshacer».
 *
 * **Sin clave foránea a `users` en los vínculos**: el dueño puede no tener
 * cuenta —perfectamente normal en una ficha que dio de alta la administración—
 * y lo que autoriza el gesto es el código, no la sesión. La relación es con el
 * negocio, y nada más.
 */

/**
 * La valla de idempotencia: una fila por update ya atendido.
 *
 * Telegram manda el mismo `update_id` hasta que el webhook contesta 200, y
 * contesta 200 en cuanto se encola el trabajo —el procesado va después, con
 * `after()`—, así que hay una ventana real en la que el mismo mensaje llega dos
 * veces. La clave primaria es el propio `update_id`: el segundo insert no entra
 * y el trabajo no se repite.
 *
 * Las filas se borran a las 48 h. No es una purga de archivo histórico —para eso
 * está `asistente_log`—: Telegram solo reintenta durante un rato corto, así que
 * pasado ese plazo la fila solo ocupa sitio. La limpieza se hace **de forma
 * oportunista**, en el mismo camino del alta y solo de vez en cuando, para no
 * pagar un `delete` en cada mensaje.
 *
 * `mode: "number"` porque el `update_id` de Telegram cabe de sobra en un entero
 * de JavaScript (es un `int32`) y contar con `BigInt` en todo el código no
 * compraría nada.
 */
export const telegramUpdates = pgTable(
  "telegram_updates",
  {
    updateId: bigint("update_id", { mode: "number" }).primaryKey(),
    creado: timestamp("creado").defaultNow().notNull(),
  },
  (table) => ({
    /* La lectura de la purga: «todo lo de antes de tal hora». */
    creadoIdx: index("telegram_updates_creado_idx").on(table.creado),
  }),
);

/**
 * Qué chat puede escribir en nombre de qué negocio.
 *
 * **Un chat, un negocio.** El `unique` sobre `chat_id` no es una optimización:
 * es lo que hace que «el negocio sale siempre del vínculo del chat» sea una
 * frase con un solo significado. Si un mismo chat pudiera apuntar a dos fichas,
 * cada mensaje tendría dos respuestas posibles y la elección acabaría dependiendo
 * de algo que el usuario escribe —justo lo que no puede pasar—. Volver a
 * vincularse reescribe la fila, que es lo que se quiere al cambiar de negocio.
 *
 * `rol` existe para que el día que entre un empleado con permiso limitado no haya
 * que migrar la tabla. Hoy todo vínculo es `dueno`.
 */
export const telegramVinculos = pgTable(
  "telegram_vinculos",
  {
    id: text("id").primaryKey(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    /** El `chat_id` de Telegram, como texto. Ver `asistente-server.ts`. */
    chatId: text("chat_id").notNull(),
    rol: text("rol", { enum: ["dueno", "empleado"] })
      .default("dueno")
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    /* El `onConflict` del alta y la resolución del chat: una fila por chat. */
    chatUnique: unique("telegram_vinculos_chat_unique").on(table.chatId),
    /* La otra lectura que existe: «¿este negocio ya tiene chat vinculado?», que
       es lo que enseña la tarjeta del panel. */
    negocioIdx: index("telegram_vinculos_negocio_idx").on(table.negocioId),
  }),
);

/**
 * El código de un solo uso que el panel genera para vincular un chat.
 *
 * **El código es la credencial.** Nadie puede escribirle al bot y decir «soy el
 * dueño de la cafetería»: hay que haber estado dentro del panel de ese negocio
 * para leer el código, y el código caduca a los diez minutos y solo vale una
 * vez. Es más corto que un token a propósito —se teclea a mano en el móvil— y
 * por eso el espacio de códigos tiene que ser amplio frente a la ventana en que
 * están vivos: ver `generarCodigo` en `asistente.ts`.
 *
 * `usado_en` no borra la fila: una fila usada es la prueba de que el vínculo se
 * hizo con un código legítimo, y sin ella no habría forma de distinguir «código
 * inventado» de «código ya gastado».
 */
export const asistenteCodigos = pgTable(
  "asistente_codigos",
  {
    id: text("id").primaryKey(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    /** El código en claro, tal como se teclea (`AA7K2M`). Un solo uso. */
    codigo: text("codigo").notNull(),
    /** Cuándo deja de valer. Diez minutos después de generarse. */
    expiraEn: timestamp("expira_en").notNull(),
    /** Cuándo se canjeó. `null` = sigue vivo (o caducó sin usarse). */
    usadoEn: timestamp("usado_en"),
    /** Por qué chat se canjeó, para poder auditar un vínculo raro. */
    usadoPor: text("usado_por"),

    creado: timestamp("creado").defaultNow().notNull(),
  },
  (table) => ({
    /* El canje busca por código, así que el único es también su índice. */
    codigoUnique: unique("asistente_codigos_codigo_unique").on(table.codigo),
    /* Y la lectura de la pizarra del panel: «los códigos de este negocio». */
    negocioIdx: index("asistente_codigos_negocio_idx").on(table.negocioId),
  }),
);

/**
 * Lo que el asistente entendió, aplicó y puede deshacer.
 *
 * Una fila por acción. Las columnas son las que hacen falta para tres cosas:
 *
 * 1. **Deshacer.** `antes` y `despues` son el estado del objetivo antes y
 *    después —no un texto bonito para leer—, y con ellos se revierte sin volver
 *    a interpretar nada. Una acción sobre un lote —el caso de «más de tres
 *    productos»— guarda **listas** en las dos columnas y se revierte entera.
 * 2. **Saber qué hizo el asistente.** `via` distingue el comando del botón, la
 *    coincidencia por texto y la llamada al modelo, que es lo que permite ver si
 *    el gasto de IA está sirviendo para algo. `mensaje` es lo que escribió la
 *    persona, sin retocar.
 * 3. **Contar el gasto.** `tokens_in`/`tokens_out` son los que devolvió la API
 *    —cero en las capas que no usan modelo— y con ellos se comprueba el límite
 *    diario.
 *
 * `pendiente` marca las filas que están esperando un Sí/No. Nacen para pedir la
 * confirmación y se aplican —o se borran— con la respuesta. Es lo que permite
 * que la confirmación sobreviva a un reinicio: el estado no vive en memoria.
 *
 * `deshecho_en` es lo que evita deshacer dos veces lo mismo: un «Deshacer» de un
 * botón viejo no puede volver a escribir por encima de un cambio posterior.
 */
export const asistenteLog = pgTable(
  "asistente_log",
  {
    id: text("id").primaryKey(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    chatId: text("chat_id").notNull(),
    /** Lo que escribió la persona. `null` cuando el gesto fue un botón. */
    mensaje: text("mensaje"),
    /** El nombre de la herramienta, o `lote` para varios cambios de una vez. */
    accion: text("accion").notNull(),
    /** Estado anterior del objetivo. Lista cuando la acción fue un lote. */
    antes: jsonb("antes").$type<unknown>(),
    /** Estado después. Lista cuando la acción fue un lote. */
    despues: jsonb("despues").$type<unknown>(),

    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    via: text("via", { enum: ["comando", "regex", "llm"] }).notNull(),

    /** Esperando confirmación. Deja de estar pendiente al aplicarse o al caerse. */
    pendiente: boolean("pendiente").default(false).notNull(),
    /** Cuándo se deshizo. `null` = sigue en pie. */
    deshechoEn: timestamp("deshecho_en"),

    ts: timestamp("ts").defaultNow().notNull(),
  },
  (table) => ({
    /* El techo de la IA se cuenta sobre las filas del día de un negocio. */
    negocioTsIdx: index("asistente_log_negocio_ts_idx").on(
      table.negocioId,
      table.ts,
    ),
    /* El rate limit por chat, y el deshacer de lo último. */
    chatTsIdx: index("asistente_log_chat_ts_idx").on(table.chatId, table.ts),
  }),
);

export const telegramVinculoRelations = relations(
  telegramVinculos,
  ({ one }) => ({
    negocio: one(places, {
      fields: [telegramVinculos.negocioId],
      references: [places.id],
    }),
  }),
);
