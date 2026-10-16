import type { UserPlaceMenuItem } from "@/lib/places-store";

/**
 * La carga y el guardado de la carta, fuera del componente.
 *
 * Estas tres funciones son el contrato entre lo que hay en `places.menu` y lo
 * que la sección de catálogo enseña y vuelve a escribir. Viven aquí y no dentro
 * de `catalogo-view.tsx` por un motivo concreto: son puras, y un campo que se
 * caiga al guardar **no da error** — simplemente desaparece de la carta del
 * negocio y nadie se entera hasta que un cliente pregunta por un precio que ya
 * no está. Siendo puras se pueden probar, y eso es lo que hace `catalogo.test.ts`.
 */

/**
 * Los productos guardados antes de que existiera el id no lo tienen, y el id es
 * lo que permite señalar uno concreto desde el asistente o desde «Hoy hay». Se
 * rellena con el índice y solo para las entradas viejas: regenerarlo en cada
 * carga cambiaría el identificador que ya está en uso.
 */
export function conIds(menu: UserPlaceMenuItem[]): UserPlaceMenuItem[] {
  return menu.map((item, i) => ({ ...item, id: item.id ?? String(i) }));
}

/** Lo que hace que dos cartas sean la misma: los campos que se editan aquí. */
export function huella(menu: UserPlaceMenuItem[]): string {
  return JSON.stringify(
    menu.map((i) => [
      i.id,
      i.name,
      i.description,
      i.price,
      i.currency,
      i.category ?? "",
      i.image ?? "",
      i.disponibilidad ?? "",
      i.agotadoHasta ?? "",
    ]),
  );
}

/**
 * Lo que se manda al servidor: la carta entera, lista.
 *
 * **Lista blanca, y a propósito.** El `PATCH` escribe `places.menu` tal cual
 * llega —no comprueba campo a campo—, así que lo que no se nombre aquí se
 * pierde al guardar. Los cinco últimos no se editan en esta pantalla pero
 * tienen que viajar igual: la chapita que puso la administración (`tag`), la
 * foto que se acaba de subir (`image`), el «agotado» de «Hoy hay»
 * (`disponibilidad`/`agotadoHasta`) y la marca del CSV, que es lo único que
 * hace posible «Deshacer importación» (`importacionId`).
 *
 * `category` e `image` se vacían a `undefined` en vez de a cadena vacía porque
 * el jsonb se lee en la carta pública: un `""` ahí es una categoría con nombre
 * vacío, que sale como un grupo fantasma.
 */
export function aGuardar(menu: UserPlaceMenuItem[]): UserPlaceMenuItem[] {
  return menu.map((item) => ({
    id: item.id,
    name: item.name.trim(),
    description: item.description,
    price: item.price,
    currency: item.currency,
    tag: item.tag,
    category: item.category?.trim() || undefined,
    image: item.image || undefined,
    disponibilidad: item.disponibilidad,
    agotadoHasta: item.agotadoHasta ?? null,
    importacionId: item.importacionId,
  }));
}
