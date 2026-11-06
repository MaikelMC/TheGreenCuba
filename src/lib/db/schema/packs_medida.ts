import {
  pgTable,
  text,
  timestamp,
  boolean,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { places } from "./places";
import { users } from "./users";

/**
 * Los packs a medida que administración arma para un negocio concreto.
 *
 * Ciclo de vida:
 *   solicitado → el dueño pulsó «Quiero mi pack» (o lo abrió administración)
 *   borrador   → administración lo está armando pero aún no lo envió
 *   enviado    → el dueño puede verlo y pagarlo
 *   pagado     → cobrado y vigente hasta `vence_en`
 *   vencido    → pasó la fecha de gracia sin renovar
 *   cancelado  → administración lo cortó en el acto
 *   rechazado  → el dueño lo rechazó
 *
 * Un negocio puede tener historial, pero la restricción parcial
 * `packs_medida_pendiente_idx` garantiza que haya a lo sumo uno en tramitación
 * (solicitado | borrador | enviado) y no hace falta comprobarlo en cada ruta.
 *
 * `servicios` y `funciones` son una foto del momento: si mañana cambia el
 * catálogo, el pack ya pagado no cambia. `funciones` la calcula el servidor al
 * guardar; el cliente solo dice qué servicios quiere, no qué funciones da.
 */

export const packsEstado = [
  "solicitado",
  "borrador",
  "enviado",
  "pagado",
  "vencido",
  "cancelado",
  "rechazado",
] as const;

export type PackMedidaEstado = (typeof packsEstado)[number];

export const packsMedida = pgTable(
  "packs_medida",
  {
    id: text("id").primaryKey(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),

    estado: text("estado", { enum: packsEstado }).default("solicitado").notNull(),

    /** Lo que el dueño marcó al solicitar (desde la vista de planes). */
    serviciosSolicitados: text("servicios_solicitados").array().default([]).notNull(),
    /** Lo que el administrador incluyó al armar el pack. */
    servicios: text("servicios").array().default([]).notNull(),
    /**
     * Funciones resultantes, calculadas por el servidor al guardar.
     * Son `Funcion[]` pero se guarda como `text[]` para no acoplar el schema
     * al catálogo: si una clave cambia de nombre, la fila histórica se lee tal
     * cual y el mapeo de permisos la descarta, igual que hace con los módulos.
     */
    funciones: text("funciones").array().default([]).notNull(),

    /**
     * Precio mensual final en USD. El servidor lo lee de aquí; el cliente
     * nunca manda un precio.
     *
     * El descuento manual (`suscripciones.descuento_pct`) no se aplica encima
     * de este precio: el pack ya es el precio negociado para ese negocio.
     */
    precioUsd: real("precio_usd"),
    /** Lo que costarían los módulos por separado, como referencia para el admin. */
    precioSugeridoUsd: real("precio_sugerido_usd"),

    /** Si el primer pago cubre 2 meses (2×1). */
    oferta2x1: boolean("oferta_2x1").default(false).notNull(),

    /** Texto para el dueño, una o dos líneas. Viaja al panel. */
    notaCliente: text("nota_cliente"),
    /** Solo para administración. */
    notaInterna: text("nota_interna"),

    /** Quién lo armó. `set null` para que el pack sobreviva al borrado del admin. */
    creadoPor: text("creado_por").references(() => users.id, {
      onDelete: "set null",
    }),

    enviadoEn: timestamp("enviado_en"),
    pagadoEn: timestamp("pagado_en"),
    venceEn: timestamp("vence_en"),

    creadoEn: timestamp("creado_en").defaultNow().notNull(),
    actualizadoEn: timestamp("actualizado_en")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    negocioIdx: index("packs_medida_negocio_idx").on(table.negocioId),
    /**
     * Solo un pack en tramitación por negocio a la vez. Los estados finales no
     * cuentan: un negocio puede tener historial y abrir un borrador nuevo.
     *
     * El índice es parcial, no una unique normal, porque la condición es sobre
     * texto y Postgres la evalúa en tiempo de inserción/actualización.
     */
    pendienteUnique: uniqueIndex("packs_medida_pendiente_idx")
      .on(table.negocioId)
      .where(
        sql`${table.estado} in ('solicitado', 'borrador', 'enviado')`,
      ),
  }),
);

export const packsMedidaRelations = relations(packsMedida, ({ one }) => ({
  negocio: one(places, {
    fields: [packsMedida.negocioId],
    references: [places.id],
  }),
  creadoPorRelacion: one(users, {
    fields: [packsMedida.creadoPor],
    references: [users.id],
  }),
}));
