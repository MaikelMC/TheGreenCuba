import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { facturas } from "./facturas";
import { pagos } from "./pagos";
import { users } from "./users";

/**
 * Los reembolsos de facturas pagadas.
 *
 * La fila es el registro de control: cuánto se devolvió, por qué, quién lo
 * autorizó y cuándo. `facturas.estado` pasa a `reembolsada`, pero el importe
 * devuelto vive aquí para que el panel de Ingresos lo reste del facturado del
 * mes sin tocar el pago original.
 *
 * Una factura solo se reembolsa una vez: el índice único de `factura_id` lo
 * impide incluso si dos administradores pulsan a la vez.
 */
export const reembolsosFacturas = pgTable(
  "reembolsos_facturas",
  {
    id: text("id").primaryKey(),
    facturaId: text("factura_id")
      .notNull()
      .references(() => facturas.id, { onDelete: "cascade" }),
    /** El pago que se devolvió. `null` en facturas antiguas sin fila de pago. */
    pagoId: text("pago_id").references(() => pagos.id, { onDelete: "set null" }),

    /** Lo devuelto, en centavos de dólar. Se toma del pago, no del navegador. */
    montoCentavos: integer("monto_centavos").notNull(),
    moneda: text("moneda").default("USD").notNull(),

    /** Obligatorio: sin motivo, el registro no sirve para control. */
    motivo: text("motivo").notNull(),

    /** Quién lo registró. El nombre se congela para que el historial no cambie. */
    registradoPor: text("registrado_por").references(() => users.id, {
      onDelete: "set null",
    }),
    registradoPorNombre: text("registrado_por_nombre").notNull(),

    creadoEn: timestamp("creado_en").defaultNow().notNull(),
  },
  (table) => ({
    facturaUnique: uniqueIndex("reembolsos_facturas_factura_unique").on(
      table.facturaId,
    ),
    fechaIdx: index("reembolsos_facturas_fecha_idx").on(table.creadoEn),
  }),
);
