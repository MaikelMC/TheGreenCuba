import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { places } from "./places";

/**
 * Un intento de pago de un plan o de un módulo.
 *
 * La fila nace **antes** de pedirle la factura a QvaPay: su `id` viaja como
 * `remote_id`, que es lo que vuelve en el webhook y lo que permite saber qué se
 * está pagando sin confiar en nada de lo que mande el navegador. El precio se
 * guarda en centavos y **lo calcula el servidor** con el catálogo; el cliente
 * solo dice qué quiere contratar.
 *
 * El estado `pendiente` es el que autoriza a aplicar el plan. El webhook cambia
 * a `pagado` y aplica el derecho en la misma transacción de Neon (`db.batch`),
 * así que un reintento no extiende el plan dos veces y un cobro sin derecho no
 * queda a medias.
 */
export const pagos = pgTable(
  "pagos",
  {
    /** También es el `remote_id` de la factura de QvaPay. */
    id: text("id").primaryKey(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),

    /* Deja sitio al segundo método sin tocar la tabla: la fila cuenta qué se
       pagó y con qué, no cómo. */
    metodo: text("metodo", { enum: ["qvapay"] }).default("qvapay").notNull(),
    tipo: text("tipo", { enum: ["plan", "modulo"] }).notNull(),
    /** La clave del pack o del módulo en el catálogo. */
    clave: text("clave").notNull(),

    /* Centavos de dólar. `integer` y no `numeric` porque el precio del catálogo
       es una cifra corta y aquí se suma y se compara, no se calcula interés. */
    montoCentavos: integer("monto_centavos").notNull(),
    moneda: text("moneda").default("USD").notNull(),

    estado: text("estado", { enum: ["pendiente", "pagado", "fallido"] })
      .default("pendiente")
      .notNull(),

    /** El `transaction_uuid` que devolvió QvaPay al crear la factura. */
    qvapayId: text("qvapay_id"),
    pagadoEn: timestamp("pagado_en"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    /* Las dos lecturas que hay: el historial de un negocio y buscar la factura
       por su id de QvaPay. `unique` en una columna anulable permite varias
       filas sin factura —las que fallaron antes de crearla—. */
    negocioFechaIdx: index("pagos_negocio_fecha_idx").on(
      table.negocioId,
      table.createdAt,
    ),
    qvapayUnique: uniqueIndex("pagos_qvapay_unique").on(table.qvapayId),
  }),
);

export const pagoRelations = relations(pagos, ({ one }) => ({
  negocio: one(places, {
    fields: [pagos.negocioId],
    references: [places.id],
  }),
}));
