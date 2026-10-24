/**
 * Traducción de errores de red.
 *
 * `fetch` solo rechaza cuando no hubo respuesta, y lo hace con un `TypeError`
 * cuyo mensaje cambia según el navegador («Failed to fetch», «Load failed»,
 * «NetworkError…»). Ese texto no le dice nada a un dueño de negocio: hay que
 * decirle que no hay conexión y que no se guardó nada.
 *
 * Un error del servidor (400, 403, 409) no es un error de red y se conserva: el
 * mensaje que manda la API suele ser el útil («El plan no incluye esta
 * función»).
 */

export const MENSAJE_SIN_CONEXION = "Sin conexión. No se guardó nada.";

/** Si el fallo parece de red y no una respuesta del servidor. */
export function esErrorDeRed(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;

  const mensaje =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return /failed to fetch|network\s?error|load failed|fetch failed|err_internet_disconnected|err_network_changed/i.test(
    mensaje,
  );
}

/** Mensaje para el usuario: claro si es red, el del servidor si no. */
export function mensajeDeRed(
  error: unknown,
  porDefecto = "No se pudo guardar. Inténtalo otra vez.",
): string {
  if (esErrorDeRed(error)) return MENSAJE_SIN_CONEXION;
  if (error instanceof Error && error.message) return error.message;
  return porDefecto;
}
