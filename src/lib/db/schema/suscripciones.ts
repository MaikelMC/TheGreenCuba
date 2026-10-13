import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { ClaveModulo } from "@/lib/plans";
import { places } from "./places";

/**
 * Un módulo suelto contratado, tal como se guarda.
 *
 * Las fechas van en ISO y no como `Date` porque esto es una columna `jsonb`: el
 * driver devuelve lo que había —una cadena—, no un `Date`. Convertirlas al leer
 * es trabajo de quien mapea la fila (`queries.ts`), no de la base.
 */
export interface ModuloGuardado {
  clave: ClaveModulo;
  desde: string;
  hasta: string | null;
}

/**
 * Lo que tiene contratado un negocio.
 *
 * Es la verdad sobre los permisos. La columna `places.plan` que ya existía dice
 * otra cosa —qué eligió el dueño en el formulario de alta— y no se toca aquí:
 * son dos datos distintos que se parecen, y mezclarlos dejaría a `places`
 * decidiendo permisos desde una tabla de fichas.
 *
 * **Una fila por negocio** (`unique`), y `cascade`: sin negocio no hay plan que
 * valga. Se crea al dar de alta el negocio con `plan: gratis` y 30 días de
 * prueba de Pro; una ficha sin fila aquí es gratis, que es el defecto seguro
 * para todo lo que existía antes de esta tabla.
 *
 * Hay **dos formas de contratar**, y conviven: el `plan` es el pack —uno de los
 * tres, o `gratis`—, y `modulos` es la lista de los sueltos. Un negocio puede
 * tener Esencial y además Facebook suelto; la función entra si cualquiera de
 * las dos la trae.
 */
export const suscripciones = pgTable(
  "suscripciones",
  {
    id: text("id").primaryKey(),
    negocioId: text("negocio_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),

    /* El pack contratado, no el efectivo: durante la prueba esto sigue siendo
       `gratis` y quien manda es `trial_hasta`. Guardar «pro» en la prueba
       borraría a qué pack se cae al terminarla. */
    plan: text("plan", {
      enum: ["gratis", "esencial", "publicidad_max", "pro"],
    })
      .default("gratis")
      .notNull(),

    /* Los módulos sueltos, con su propia vigencia. `[]` y `notNull` en vez de
       `null`: «no tiene ninguno» y «la columna no está» no son casos distintos
       aquí, y un `null` obligaría a comprobarlo en cada lectura. */
    modulos: jsonb("modulos").$type<ModuloGuardado[]>().default([]).notNull(),

    /* Cancelar corta el acceso en el acto sin borrar la fila: es lo que hace
       falta para dar de baja a alguien sin perder de vista que estuvo. */
    estado: text("estado", { enum: ["activa", "cancelada"] })
      .default("activa")
      .notNull(),

    /** Hasta cuándo dura la prueba de Pro. Nulo = no está en prueba. */
    trialHasta: timestamp("trial_hasta"),
    /** Hasta cuándo está pagado. Nulo = sin vencimiento. */
    venceEn: timestamp("vence_en"),
    /** Descuento acordado (0–100). Nulo = tarifa completa. */
    descuentoPct: integer("descuento_pct"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    /* Sin índice aparte: `unique` ya crea el que respalda las búsquedas por
       negocio, que son todas las que hay. */
    negocioUnique: unique("suscripciones_negocio_unique").on(table.negocioId),
    /* Un porcentaje fuera de rango no rompe nada, simplemente descuenta de más
       o de menos en una factura que se calcula a mano. La restricción evita que
       eso pase sin que nadie lo vea. */
    descuentoCheck: check(
      "suscripciones_descuento_check",
      sql`${table.descuentoPct} is null or (${table.descuentoPct} >= 0 and ${table.descuentoPct} <= 100)`,
    ),
  }),
);

export const suscripcionRelations = relations(suscripciones, ({ one }) => ({
  negocio: one(places, {
    fields: [suscripciones.negocioId],
    references: [places.id],
  }),
}));
