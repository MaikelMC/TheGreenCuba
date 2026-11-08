import { pgTable, text, integer, timestamp, index, unique } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * El dinero del programa de afiliados que **sale**.
 *
 * Lo que el afiliado gana no se guarda: se calcula cada vez a partir de `pagos`
 * de los negocios que trajo (ver `src/lib/afiliados.ts`). Guardarlo sería una
 * segunda verdad que se desincroniza en cuanto un pago cambie de estado. Lo que
 * sí hay que guardar es lo que no se puede deducir: cuánto pidió cobrar, por
 * dónde y si ya se le pagó.
 *
 * Importes en **centavos de CUP**, que es la moneda en la que se le paga. La
 * comisión se calcula en USD (los pagos son en USD) y se pasa a CUP con la tasa
 * del programa en el momento de pedir; la tasa usada queda en la fila para que
 * el número no cambie después si la tasa sube.
 */
export const afiliadoCobros = pgTable(
  "afiliado_cobros",
  {
    id: text("id").primaryKey(),
    afiliadoId: text("afiliado_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    montoCupCentavos: integer("monto_cup_centavos").notNull(),
    /** Lo mismo en centavos de USD, para descontarlo del saldo sin depender de la tasa. */
    montoUsdCentavos: integer("monto_usd_centavos").notNull(),
    tasaUsdCup: integer("tasa_usd_cup").notNull(),
    metodo: text("metodo", { enum: ["saldo", "transferencia_cup", "cubapay"] }).notNull(),
    /** Teléfono o tarjeta a donde se le paga. Lo escribe el afiliado. */
    destino: text("destino").notNull(),
    estado: text("estado", { enum: ["pedido", "pagado", "rechazado"] })
      .default("pedido")
      .notNull(),
    /** Quién lo marcó como pagado o rechazado, y una nota (comprobante, motivo). */
    resueltoPor: text("resuelto_por").references(() => users.id, { onDelete: "set null" }),
    nota: text("nota"),
    resueltoEn: timestamp("resuelto_en"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    afiliadoIdx: index("afiliado_cobros_afiliado_idx").on(table.afiliadoId, table.createdAt),
    estadoIdx: index("afiliado_cobros_estado_idx").on(table.estado),
  }),
);

/**
 * Premios del programa ya entregados. Que un afiliado **gane** un premio se
 * calcula (metas del mes); aquí solo queda que se le entregó, una vez por mes y
 * tipo (`unique`), para que no salga dos veces en «Para hacer».
 */
export const afiliadoPremios = pgTable(
  "afiliado_premios",
  {
    id: text("id").primaryKey(),
    afiliadoId: text("afiliado_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `AAAA-MM` del mes en que se ganó. */
    mes: text("mes").notNull(),
    tipo: text("tipo", { enum: ["bono", "recarga_internacional"] }).notNull(),
    entregadoPor: text("entregado_por").references(() => users.id, { onDelete: "set null" }),
    entregadoEn: timestamp("entregado_en").defaultNow().notNull(),
  },
  (table) => ({
    unico: unique("afiliado_premios_unico").on(table.afiliadoId, table.mes, table.tipo),
  }),
);

/** Notas internas sobre un afiliado. Solo las ven los administradores. */
export const afiliadoNotas = pgTable(
  "afiliado_notas",
  {
    id: text("id").primaryKey(),
    afiliadoId: text("afiliado_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    autorId: text("autor_id").references(() => users.id, { onDelete: "set null" }),
    texto: text("texto").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    afiliadoIdx: index("afiliado_notas_afiliado_idx").on(table.afiliadoId, table.createdAt),
  }),
);
