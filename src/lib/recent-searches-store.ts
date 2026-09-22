/**
 * Historial de búsquedas del usuario.
 *
 * Vive en `localStorage`, como el resto del MVP —los lugares, las preferencias y
 * la actividad—, porque no hay base de datos a la que mandarlo. Antes el
 * desplegable del buscador enseñaba dos búsquedas de ejemplo escritas a mano en
 * el componente, que salían iguales para todo el mundo y para siempre, incluso
 * en un navegador recién estrenado donde nadie había buscado nada todavía.
 */

export interface RecentSearch {
  query: string;
  /** Última vez que se buscó, en milisegundos UNIX. */
  at: number;
}

const STORAGE_KEY = "la-verde:recent-searches";

/** Tope de entradas: cinco caben en el desplegable sin hacerlo largo. */
const MAX_ITEMS = 5;

function write(items: RecentSearch[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage no disponible (modo privacidad) — se ignora, como en el
    // resto de almacenes del proyecto.
  }
}

export function readRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (v): v is RecentSearch =>
          Boolean(v) &&
          typeof v === "object" &&
          typeof (v as RecentSearch).query === "string" &&
          (v as RecentSearch).query.length > 0 &&
          typeof (v as RecentSearch).at === "number",
      )
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

/**
 * Añade una búsqueda al historial y devuelve la lista ya actualizada.
 *
 * La repetición no se duplica: se sube al principio. Buscar dos veces lo mismo
 * —o reintentar tras un fallo de red— tiene que dejar una sola fila, la de
 * arriba.
 */
export function pushRecentSearch(query: string): RecentSearch[] {
  const clean = query.trim();
  if (!clean) return readRecentSearches();
  const rest = readRecentSearches().filter(
    (s) => s.query.toLowerCase() !== clean.toLowerCase(),
  );
  const next = [{ query: clean, at: Date.now() }, ...rest].slice(0, MAX_ITEMS);
  write(next);
  return next;
}
