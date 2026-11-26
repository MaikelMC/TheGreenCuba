import {
  pgTable,
  text,
  timestamp,
  real,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { places } from "./places";
import { packsMedida } from "./packs_medida";
import { pagos } from "./pagos";
import { users } from "./users";

/**
 * Las facturas que administración envía al dueño de un negocio.
 *
 * No son el cobro: son el documento que el cliente abre desde un enlace
 * compartible, revisa y acepta. Cuando administración confirma el pago se crea
 * una fila en `pagos`, se aplica el derecho con `aplicarDerecho` y la factura
 * pasa a `pagada`. Así el flujo de cobro sigue siendo uno solo.
 *
 * `conceptos` es una **foto** de lo que se vendió: nombres y líneas del
 * catálogo en el momento de emitirla. Si mañana cambia un precio o un texto,
 * la factura histórica no cambia.
 */
export const facturasEstado = [
  "enviada",
  "aceptada",
  "pagada",
  "cancelada",
] as const;

export type FacturaEstado = (typeof facturasEstado)[number];

export interface FacturaConcepto {
  nombre: string;
  detalle: string[];
}

export const facturas = pgTable(
  "facturas",
  {
    /** También es el identificador público del enlace `/factura/<id>`. */
    id: text("id").primaryKey(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    /** Nombre congelado: el negocio puede cambiar de nombre después. */
    negocioNombre: text("negocio_nombre").notNull(),

    tipo: text("tipo", { enum: ["pack_medida", "plan"] }).notNull(),
    /** Pack a medida facturado, si aplica. */
    packId: text("pack_id").references(() => packsMedida.id, {
      onDelete: "set null",
    }),
    /** Clave del plan estándar, si aplica. */
    planClave: text("plan_clave"),

    titulo: text("titulo").notNull(),
    conceptos: jsonb("conceptos")
      .$type<FacturaConcepto[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    nota: text("nota"),

    precioUsd: real("precio_usd").notNull(),
    /** Precio de lista antes del descuento, para enseñar el ahorro. */
    precioOriginalUsd: real("precio_original_usd"),
    descuentoPct: integer("descuento_pct"),
    oferta2x1: boolean("oferta_2x1").default(false).notNull(),
    /** Tasa usada al emitir, para que el CUP no baile después. */
    tasaCup: real("tasa_cup"),

    estado: text("estado", { enum: facturasEstado })
      .default("enviada")
      .notNull(),

    creadoPor: text("creado_por").references(() => users.id, {
      onDelete: "set null",
    }),
    /** El pago manual que la confirmó. Evita duplicarlo si se reintenta. */
    pagoId: text("pago_id").references(() => pagos.id, {
      onDelete: "set null",
    }),

    enviadaEn: timestamp("enviada_en").defaultNow().notNull(),
    aceptadaEn: timestamp("aceptada_en"),
    pagadaEn: timestamp("pagada_en"),
    canceladaEn: timestamp("cancelada_en"),

    creadoEn: timestamp("creado_en").defaultNow().notNull(),
    actualizadoEn: timestamp("actualizado_en")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    negocioIdx: index("facturas_negocio_idx").on(
      table.negocioId,
      table.creadoEn,
    ),
    estadoIdx: index("facturas_estado_idx").on(table.estado, table.creadoEn),
    packIdx: index("facturas_pack_idx").on(table.packId),
  }),
);

export const facturaRelations = relations(facturas, ({ one }) => ({
  negocio: one(places, {
    fields: [facturas.negocioId],
    references: [places.id],
  }),
  pack: one(packsMedida, {
    fields: [facturas.packId],
    references: [packsMedida.id],
  }),
  pago: one(pagos, {
    fields: [facturas.pagoId],
    references: [pagos.id],
  }),
  creadoPorRelacion: one(users, {
    fields: [facturas.creadoPor],
    references: [users.id],
  }),
}));
