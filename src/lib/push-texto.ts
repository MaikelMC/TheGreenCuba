/**
 * El texto de una notificación del sistema, con las mismas reglas para todo lo
 * que se empuja al móvil.
 *
 * Vive aparte de `push-server` porque lo usan los dos lados: el servidor al
 * componer el cuerpo y el panel de administración para enseñar cómo quedará el
 * aviso antes de enviarlo. `push-server` importa la base de datos y `web-push`;
 * nada de eso puede acabar en el bundle del navegador.
 *
 * Cuánto cabe: el título entero en una línea y el cuerpo en dos. Lo que pase de
 * ahí el sistema operativo lo recorta a su gusto —en mitad de una palabra—, así
 * que se recorta antes y con puntos suspensivos.
 */

export const MAX_TITULO_PUSH = 120;
export const MAX_CUERPO_PUSH = 160;

/**
 * Recorta por palabra, no por letra.
 *
 * Un `slice` a secas deja «cafeterí…» o media palabra colgando y el aviso se
 * lee como un error de la app. Se corta en el último espacio que quepa; si no
 * hay ninguno razonable —una palabra larguísima—, se corta donde toca.
 *
 * También aplana los saltos de línea: la notificación del sistema es una sola
 * línea de texto, y un mensaje de administración con párrafos llegaría con
 * huecos raros.
 */
export function recortarTexto(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= max) return limpio;

  const corte = limpio.slice(0, max - 1);
  const espacio = corte.lastIndexOf(" ");
  const base = espacio > max * 0.5 ? corte.slice(0, espacio) : corte;
  return `${base.trimEnd()}…`;
}
