import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * El catálogo de planes, pisado desde administración.
 *
 * Es la única tabla del proyecto con **una sola fila**, y a propósito: no hay
 * historial de precios ni catálogo por negocio, así que una tabla sin clave
 * natural se llena de filas huérfanas en cuanto alguien guarde dos veces. El
 * `id` fijo es lo que hace que el guardado sea un `upsert` y no un duplicado.
 *
 * `datos` lleva el catálogo entero tal como lo dejó el panel, **sin normalizar**.
 * No se lee crudo nunca: pasa por `normalizarCatalogo` antes de usarse, porque
 * un jsonb viejo o a medio escribir no puede tumbar la resolución de permisos
 * —es la misma frontera de confianza que la entrada de una API, solo que aquí
 * quien la cruza es el paso del tiempo—.
 */
export const catalogoPlanes = pgTable("catalogo_planes", {
  id: text("id").primaryKey(),
  datos: jsonb("datos").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

/** El `id` de la única fila. Constante, para que el upsert sea un upsert. */
export const CATALOGO_ID = "planes";
