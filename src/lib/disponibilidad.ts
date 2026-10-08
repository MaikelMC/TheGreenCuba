/**
 * «Hoy hay»: la disponibilidad de un producto.
 *
 * Los productos no son filas sino entradas del jsonb `places.menu`, así que su
 * estado vive dentro de cada entrada: `disponibilidad` y `agotadoHasta`. Este
 * módulo es puro a propósito —lo leen el servidor y el navegador— y aquí está
 * **la única regla que importa**: un producto marcado como agotado se vuelve a
 * considerar disponible solo cuando pasa `agotadoHasta`, sin cron ni trabajo
 * programado. La comparación se hace al leer, que es el único momento en que el
 * «ahora» significa algo.
 */

export type Disponibilidad = "disponible" | "agotado";

/** Lo mínimo que hace falta para saber si un producto está agotado ahora. */
export interface EstadoDisponibilidad {
  disponibilidad?: Disponibilidad;
  /** Epoch en ms. `null`/ausente = agotado sin fecha de vuelta. */
  agotadoHasta?: number | null;
}

/**
 * ¿Está agotado **ahora mismo**?
 *
 * `true` solo si el dueño lo marcó como agotado y, o no puso fecha de vuelta, o
 * esa fecha todavía no ha pasado. Cuando `agotadoHasta` queda atrás, el producto
 * vuelve solo a estar disponible: nadie tiene que recorrer la base ni despertar
 * ningún proceso.
 */
export function estaAgotado(
  item: EstadoDisponibilidad,
  now: number = Date.now(),
): boolean {
  if (item.disponibilidad !== "agotado") return false;
  if (item.agotadoHasta != null && item.agotadoHasta <= now) return false;
  return true;
}

/**
 * La marca de tiempo para «agotado hasta mañana»: la medianoche local siguiente.
 *
 * A medianoche en punto el producto vuelve a estar disponible durante todo el
 * día, que es lo que el dueño quiere decir con «mañana lo tengo». Se calcula en
 * hora local y no sumando 24 h: sumar 24 h dejaría el producto agotado hasta la
 * misma hora de mañana, media mañana de más para quien abre temprano.
 */
export function hastaManana(now: Date = new Date()): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}
