/**
 * El orden de «Cerca de ti».
 *
 * Primero lo que se puede visitar ahora, por distancia. Después lo cerrado,
 * por lo que abre antes: a medianoche importa más el que abre a las 8 que el
 * que está a dos calles pero no abre hasta el lunes. La distancia desempata.
 *
 * Módulo puro y sin React para poder probarlo con casos de medianoche, días
 * cerrados y fichas sin horario.
 */

export interface LugarOrdenable {
  /** `true` abierto, `false` cerrado, `null` no se puede afirmar. */
  abierto: boolean | null;
  /** Próxima apertura en epoch ms; `null` si no se conoce. */
  proximaApertura: number | null;
  /** Distancia en metros; `null` si no hay origen. */
  distanceM: number | null;
}

function distancia(lugar: LugarOrdenable): number {
  return lugar.distanceM ?? Number.POSITIVE_INFINITY;
}

function apertura(lugar: LugarOrdenable): number {
  return lugar.proximaApertura ?? Number.POSITIVE_INFINITY;
}

/* `Infinity - Infinity` es `NaN`, y un comparador que devuelve `NaN` deja el
   orden en manos del motor. Se comparan los valores, no se restan. */
function comparar(a: number, b: number): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Devuelve una copia ordenada. No muta la entrada.
 *
 * `null` (sin horario que permita afirmar nada) va al final: no se puede
 * prometer que esté abierto ni decir cuándo abre.
 */
export function ordenarCercaDeTi<T extends LugarOrdenable>(
  lugares: readonly T[],
): T[] {
  return lugares
    .map((lugar, indice) => ({ lugar, indice }))
    .sort((a, b) => {
      const rango = (lugar: LugarOrdenable): number =>
        lugar.abierto === true ? 0 : lugar.abierto === false ? 1 : 2;

      const porEstado = rango(a.lugar) - rango(b.lugar);
      if (porEstado !== 0) return porEstado;

      if (a.lugar.abierto === true) {
        const porDistancia = comparar(distancia(a.lugar), distancia(b.lugar));
        return porDistancia !== 0 ? porDistancia : a.indice - b.indice;
      }

      if (a.lugar.abierto === false) {
        const porApertura = comparar(apertura(a.lugar), apertura(b.lugar));
        if (porApertura !== 0) return porApertura;
        const porDistancia = comparar(distancia(a.lugar), distancia(b.lugar));
        return porDistancia !== 0 ? porDistancia : a.indice - b.indice;
      }

      const porDistancia = comparar(distancia(a.lugar), distancia(b.lugar));
      return porDistancia !== 0 ? porDistancia : a.indice - b.indice;
    })
    .map(({ lugar }) => lugar);
}
