import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { places } from "./places";

/**
 * Los recordatorios de pago que ya se mandaron.
 *
 * Existe por una razón muy concreta: el trabajo que los envía corre **todos los
 * días**, y el mismo aviso —«te quedan cinco días»— tiene que salir una sola vez
 * por negocio y por fecha de vencimiento. Sin esta tabla, un cron que se ejecuta
 * treinta veces al mes manda treinta correos.
 *
 * La clave es (negocio, fecha de pago, momento) y no (negocio, momento): cuando
 * el pago se renueva, `vence_en` cambia, y con la clave corta el aviso del mes
 * siguiente quedaría bloqueado por el del anterior.
 *
 * `push_enviado_en` y `email_enviado_en` se guardan por separado a propósito. Un
 * push sin VAPID configurado o un Resend sin clave no son «enviado»: dejarlos en
 * nulo permite que el canal salga en cuanto se configure, sin reenviar el otro
 * canal que ya había llegado.
 */
export const recordatoriosPago = pgTable(
  "recordatorios_pago",
  {
    id: text("id").primaryKey(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    /** La fecha de vencimiento que se recordó: `trial_hasta` o `vence_en`. */
    fechaPago: timestamp("fecha_pago").notNull(),
    /** `proximo` (cinco días antes), `vispera` o `vencido`. */
    tipo: text("tipo", { enum: ["proximo", "vispera", "vencido"] }).notNull(),

    pushEnviadoEn: timestamp("push_enviado_en"),
    emailEnviadoEn: timestamp("email_enviado_en"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    unico: unique("recordatorios_pago_unico").on(
      table.negocioId,
      table.fechaPago,
      table.tipo,
    ),
    /* El trabajo diario pregunta por muchas fichas a la vez; sin este índice
       eso sería un recorrido completo de la tabla en cada pasada. */
    negocioIdx: index("recordatorios_pago_negocio_idx").on(table.negocioId),
  }),
);

export const recordatorioPagoRelations = relations(
  recordatoriosPago,
  ({ one }) => ({
    negocio: one(places, {
      fields: [recordatoriosPago.negocioId],
      references: [places.id],
    }),
  }),
);
