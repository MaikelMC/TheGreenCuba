import {
  CUBA_PROVINCES,
  LOCATION_LEGACY_VALUES,
  locationLabel,
  type UserPreferences,
} from "@/lib/user-preferences-store";
import type { UserPlace } from "@/lib/places-store";

/**
 * La provincia del usuario en la búsqueda.
 *
 * Vive en su propio módulo y no dentro de `personalized-recommendations` porque
 * lo necesitan tres sitios sin relación entre sí: el ranking del home, la
 * búsqueda con IA (que arma el catálogo que viaja al modelo) y las sugerencias.
 * Dos tablas de provincias que se separan con el tiempo serían peor que una.
 *
 * Todo compara **etiquetas** («Santiago de Cuba») y no slugs: el catálogo trae
 * `city`/`province` como texto libre escrito por el dueño o la siembra, y en la
 * práctica ciudad y provincia son la misma cadena. Comparar por slug obligaría
 * a una tabla de equivalencias más que nadie mantiene.
 */

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * La provincia del perfil, en etiqueta lista para comparar o para el prompt.
 *
 * `null` en los casos donde no se puede afirmar nada: sin perfil, con «otra»
 * (que significa «no detectada») o con un valor que ya no existe en el
 * selector. Un `null` no filtra: deja la búsqueda como estaba.
 */
export function userProvinceLabel(prefs: UserPreferences | null | undefined): string | null {
  if (!prefs?.location) return null;
  if (prefs.location === "otra") return null;
  const label = locationLabel(prefs.location);
  /* `locationLabel` devuelve el propio valor si no lo conoce; para «otra» y
     desconocidos eso sería una etiqueta falsa. El guard de arriba ya filtró
     «otra»; aquí se comprueba que la etiqueta exista de verdad. */
  if (!label || label === prefs.location) return null;
  return label;
}

/** La provincia del negocio, tal como la escribió quien lo dio de alta. */
function placeProvince(p: UserPlace): string {
  return (p.province || p.city || "").trim();
}

/**
 * `true` si el negocio pertenece a la provincia del usuario.
 *
 * Compara normalizado sin acentos, y por contención en ambas direcciones: la
 * base dice «Santiago de Cuba» en casi toda la siembra pero «Vista Alegre» en
 * una fila —el dueño escribió su barrio como ciudad—, y una igualdad estricta
 * dejaría fuera fichas que sí son de aquí.
 */
export function placeInUserProvince(place: UserPlace, provinceLabel: string): boolean {
  const placeP = normalize(placeProvince(place));
  if (!placeP) return false;
  const target = normalize(provinceLabel);
  return placeP.includes(target) || target.includes(placeP);
}

/**
 * ¿Menciona la consulta otra provincia por su nombre?
 *
 * Es la salida del filtro duro: «restaurantes en La Habana» escrito por alguien
 * de Santiago debe encontrar La Habana. Se busca la etiqueta de cualquier
 * provincia (y su slug) como palabra en la consulta; si aparece una distinta a
 * la del usuario, el filtro se retira para esa búsqueda.
 *
 * La lista sale de `CUBA_PROVINCES`, el mismo vocabulario del selector del
 * perfil, más los valores antiguos que siguen resolviendo etiqueta.
 */
export function queryMentionsOtherProvince(query: string, provinceLabel: string): boolean {
  const haystack = normalize(query);
  if (!haystack) return false;
  for (const { label, value } of PROVINCE_TERMS) {
    if (label === provinceLabel) continue;
    const candidates = [label, value.replace(/-/g, " ")];
    if (candidates.some((c) => new RegExp(`\\b${escapeRegExp(normalize(c))}\\b`).test(haystack))) {
      return true;
    }
  }
  return false;
}

/** Etiqueta + slug de cada provincia, incluidos los valores antiguos. */
const PROVINCE_TERMS: { label: string; value: string }[] = [
  ...CUBA_PROVINCES,
  ...LOCATION_LEGACY_VALUES.map((value) => ({ value, label: locationLabel(value) })),
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
