/**
 * Cómo se escriben el barrio y la dirección de un lugar.
 *
 * La base guarda lo que escribió cada dueño: «centro de la ciudad», «LOS
 * MURROS», «Dirección: Calle 3 #12». Eso está bien como dato, pero no como
 * texto de una tarjeta. Estas funciones normalizan **solo al mostrar** (y al
 * crear una ficha nueva), nunca reescriben filas existentes.
 *
 * No dependen de React ni de la base: las usan el mapeo del servidor, el home,
 * la ficha y las pruebas.
 */

/** Une solo las partes que existen. Evita el «·» suelto de una categoría sin barrio. */
export function unirPartes(
  partes: ReadonlyArray<string | null | undefined>,
  separador = " · ",
): string {
  return partes
    .map((parte) => parte?.trim() ?? "")
    .filter((parte) => parte.length > 0)
    .join(separador);
}

/* Partículas que van en minúscula dentro de un nombre propio. La primera
   palabra nunca se rebaja: «La Habana» empieza por «La». */
const PARTICULAS = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "el",
  "y",
  "e",
  "a",
  "en",
  "con",
  "por",
  "para",
  "al",
]);

const ROMANO = /^[IVXLCDM]{2,}$/;

function capitalizarPalabra(palabra: string): string {
  /* Después de un guion o un apóstrofo también empieza una palabra:
     «d'Luxe» → «D'Luxe», «Altamira-Sur» → «Altamira-Sur». */
  return palabra.replace(/(^|[-'’])(\p{L})/gu, (_todo, separador: string, letra: string) =>
    `${separador}${letra.toLocaleUpperCase("es")}`,
  );
}

/**
 * «santa bárbara» → «Santa Bárbara»; «los murros de altamira» → «Los Murros de
 * Altamira». Respeta las partículas y los números romanos.
 */
export function formatearBarrio(valor: string | null | undefined): string {
  const limpio = (valor ?? "").replace(/\s+/g, " ").trim();
  if (!limpio) return "";

  return limpio
    .split(" ")
    .map((palabra, indice) => {
      const minuscula = palabra.toLocaleLowerCase("es");
      if (indice > 0 && PARTICULAS.has(minuscula)) return minuscula;
      const mayuscula = palabra.toLocaleUpperCase("es");
      if (ROMANO.test(mayuscula)) return mayuscula;
      return capitalizarPalabra(minuscula);
    })
    .join(" ");
}

/* «Dirección: Calle 3», «Dir. 3ra», «DIRECCION - 3ra». Se quita el prefijo y
   el separador que lo acompaña; si el dueño escribió «Dirección Calle 3» sin
   dos puntos, también. */
const PREFIJO_DIRECCION = /^\s*(?:direcci[oó]n|dir)\s*\.?\s*[:.\-–—]?\s*/i;

/**
 * Quita el prefijo «Dirección»/«Dir.» y los espacios de más. No cambia las
 * mayúsculas: una dirección mezcla nombres propios y números.
 */
export function formatearDireccion(valor: string | null | undefined): string {
  return (valor ?? "")
    .replace(PREFIJO_DIRECCION, "")
    .replace(/\s+/g, " ")
    .trim();
}
