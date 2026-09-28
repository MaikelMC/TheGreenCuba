/**
 * Lo que la IA dijo de cada lugar, para que la ficha lo pueda repetir.
 *
 * El servidor ya devuelve una razón por lugar —`matches: [{ id, reason }]` en
 * `/api/ai/search`— y hasta ahora solo servía para ordenar la lista: el `reason`
 * se tiraba justo antes de que alguien pudiera leerlo. La ficha enseñaba
 * «Restaurante en Centro histórico» a quien acababa de pedir un café tranquilo
 * con wifi, que es información de la que ya disponía pero peor.
 *
 * Vive en `localStorage` y no en la base por dos razones. La primera es que el
 * clic en una tarjeta navega a `/place/[id]` con `router.push`, así que el
 * contexto no sobrevive como prop. La segunda es que meterlo en Postgres pedía
 * tabla nueva y una escritura por búsqueda para un texto que solo decora la
 * ficha. Es el mismo sitio donde ya viven las búsquedas recientes y la
 * actividad, con las mismas guardas.
 */

export interface AiRecommendation {
  /** El prompt del usuario, tal como lo escribió. */
  query: string;
  /** La frase que la IA dio sobre ESTE lugar. */
  reason: string;
  /** Cuándo se buscó, en milisegundos UNIX. */
  at: number;
}

const STORAGE_KEY = "la-verde:ai-recommendations";

/** Cinco lugares por búsqueda, las últimas cuatro. */
const MAX_ITEMS = 20;

/**
 * Un día. Sin caducidad, abrir desde el mapa un sitio que salió ayer en una
 * búsqueda diría «Buscaste…» sobre algo que el usuario ya no recuerda haber
 * escrito, que es peor que no decir nada.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

type Store = Record<string, AiRecommendation>;

function isRecommendation(value: unknown): value is AiRecommendation {
  if (!value || typeof value !== "object") return false;
  const r = value as AiRecommendation;
  return (
    typeof r.query === "string" &&
    r.query.length > 0 &&
    typeof r.reason === "string" &&
    r.reason.length > 0 &&
    typeof r.at === "number"
  );
}

/** Lo que hay guardado, ya sin lo caducado ni lo que no tenga forma esperada. */
function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const cutoff = Date.now() - TTL_MS;
    const out: Store = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (isRecommendation(value) && value.at >= cutoff) out[id] = value;
    }
    return out;
  } catch {
    /* localStorage no disponible (modo privacidad) o JSON roto: la ficha se
       queda con su texto de siempre, que no es un fallo. */
    return {};
  }
}

function write(store: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Sin sitio donde guardarlo — se pierde el adorno, no la ficha.
  }
}

/** Corta por recencia. Se aplica al escribir, que es cuando el almacén crece. */
function prune(store: Store): Store {
  const entries = Object.entries(store).sort((a, b) => b[1].at - a[1].at);
  return Object.fromEntries(entries.slice(0, MAX_ITEMS));
}

/**
 * Guarda la razón que la IA dio para cada lugar de esta búsqueda.
 *
 * Se escribe una entrada por lugar y no una por búsqueda porque quien lee es la
 * ficha, y la ficha sabe su id: guardar la lista entera obligaría a recorrerla
 * en cada apertura. Un lugar que se repita entre dos búsquedas se queda con la
 * última, que es la que el usuario tiene en la cabeza.
 */
export function saveAiRecommendations(
  query: string,
  matches: { id: string; reason: string }[],
): void {
  const clean = query.trim();
  if (!clean || matches.length === 0) return;

  const now = Date.now();
  const store = read();

  for (const match of matches) {
    const reason = match.reason?.trim();
    if (!match.id || !reason) continue;
    store[match.id] = { query: clean, reason, at: now };
  }

  write(prune(store));
}

/** La recomendación de este lugar, o `null` si no vino de una búsqueda. */
export function readAiRecommendation(placeId: string): AiRecommendation | null {
  if (!placeId) return null;
  return read()[placeId] ?? null;
}
