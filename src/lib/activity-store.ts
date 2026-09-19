/**
 * Los seis lugares del relleno de ejemplo.
 *
 * Los ids son los del catálogo de Neon —que ahora son slugs estables y no
 * aleatorios, precisamente para poder escribirlos aquí— así que cada fila
 * apunta a un negocio real y su enlace funciona. Antes salían de la semilla del
 * cliente, que ya no existe: los lugares los sirve la base.
 */
const DEMO_PICKS = [
  { id: "primos-twice", name: "Primos Twice", category: "Restaurante" },
  { id: "casa-la-micaela", name: "Casa La Micaela", category: "Cafetería" },
  { id: "casa-de-la-trova", name: "Casa de la Trova 'Pepe Sánchez'", category: "Bar" },
  { id: "playa-siboney", name: "Playa Siboney", category: "Playa" },
  { id: "hotel-casa-granda", name: "Hotel Casa Granda", category: "Hospedaje" },
  { id: "mercado-municipal", name: "Mercado Municipal", category: "Mercado" },
];

/**
 * Actividad del usuario con los lugares: qué abre y qué guarda.
 *
 * Vive en `localStorage`, como el resto del MVP —los lugares y las
 * preferencias—, porque no hay base de datos a la que mandarlo. Eso acota lo
 * que esto puede ser: métricas de *este* navegador, no del conjunto de usuarios.
 * Un lugar muy abierto aquí significa «tú lo abres mucho», no «es popular en
 * Cuba», y la pantalla que las enseña lo dice con esas palabras.
 */

const STORAGE_KEY = "la-verde:activity";

/** Tope de marcas de tiempo. Con 300 sobra para el histograma de dos semanas. */
const MAX_STAMPS = 300;

/**
 * Dos montajes del mismo lugar dentro de esta ventana cuentan como uno.
 *
 * `PlaceDetail` se pinta a la vez en el panel de escritorio y en la hoja de
 * móvil del home, así que el `useEffect` que registra la visita corre dos veces
 * para la misma apertura. Sin esta guarda, la primera visita contaría doble
 * justo cuando el usuario está mirando el contador.
 */
const DUPLICATE_WINDOW_MS = 30_000;

export interface PlaceVisit {
  placeId: string;
  name: string;
  category: string;
  count: number;
  /** Última apertura, en milisegundos UNIX. */
  lastAt: number;
}

export interface ActivityState {
  visits: PlaceVisit[];
  savedIds: string[];
  /** Marca de tiempo de cada apertura, para el histograma por día. */
  stamps: number[];
  /**
   * `true` cuando lo que se está devolviendo es el relleno de ejemplo y no
   * actividad real. Quien lo pinte tiene que decirlo: son cifras inventadas y
   * hacerlas pasar por medidas sería mentir en la única pantalla que presume de
   * medir.
   */
  isDemo: boolean;
}

const EMPTY: ActivityState = { visits: [], savedIds: [], stamps: [], isDemo: false };

function numberField(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function parseVisit(v: unknown): PlaceVisit | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  if (typeof p.placeId !== "string" || typeof p.name !== "string") return null;
  return {
    placeId: p.placeId,
    name: p.name,
    category: typeof p.category === "string" ? p.category : "Otro",
    count: Math.max(1, Math.trunc(numberField(p.count, 1))),
    lastAt: numberField(p.lastAt, 0),
  };
}

function readRaw(): ActivityState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const visits = Array.isArray(parsed.visits)
      ? parsed.visits.map(parseVisit).filter((v): v is PlaceVisit => v !== null)
      : [];
    const savedIds = Array.isArray(parsed.savedIds)
      ? parsed.savedIds.filter((x): x is string => typeof x === "string")
      : [];
    const stamps = Array.isArray(parsed.stamps)
      ? parsed.stamps
          .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
          .slice(-MAX_STAMPS)
      : [];
    return { visits, savedIds, stamps, isDemo: false };
  } catch {
    return EMPTY;
  }
}

function write(state: Omit<ActivityState, "isDemo">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage no disponible (modo privado) — se pierde la métrica, no la visita.
  }
}

/**
 * Relleno para cuando todavía no hay nada que medir.
 *
 * Los ids y los nombres salen de `DEMO_PICKS`, así que cada fila apunta a un
 * lugar que existe de verdad en el catálogo y su enlace funciona. Las marcas de
 * tiempo se generan relativas a ahora para que el histograma tenga forma en vez
 * de salir plano.
 */
function demoState(now: number): ActivityState {
  const [a, b, c, d, e, f] = DEMO_PICKS;
  const picks: { place: (typeof DEMO_PICKS)[number] | undefined; count: number; days: number }[] = [
    { place: c, count: 9, days: 0 },
    { place: b, count: 7, days: 1 },
    { place: a, count: 6, days: 2 },
    { place: e, count: 4, days: 4 },
    { place: d, count: 3, days: 6 },
    { place: f, count: 2, days: 9 },
  ];

  const visits: PlaceVisit[] = [];
  const stamps: number[] = [];
  const DAY = 24 * 60 * 60 * 1000;

  for (const { place, count, days } of picks) {
    if (!place) continue;
    visits.push({
      placeId: place.id,
      name: place.name,
      category: place.category,
      count,
      lastAt: now - days * DAY,
    });
    // Reparte las aperturas hacia atrás desde el último día en que se abrió.
    for (let i = 0; i < count; i += 1) {
      stamps.push(now - (days + Math.floor(i / 2)) * DAY - i * 60 * 60 * 1000);
    }
  }

  return {
    visits: visits.sort((x, y) => y.count - x.count),
    savedIds: [b?.id, c?.id].filter((x): x is string => typeof x === "string"),
    stamps: stamps.sort((x, y) => x - y).slice(-MAX_STAMPS),
    isDemo: true,
  };
}

/**
 * Estado de la actividad. Si no hay ninguna, devuelve el relleno marcado con
 * `isDemo`. El relleno **no se escribe** en el almacenamiento: en cuanto haya
 * una visita real, desaparece solo.
 */
export function readActivity(now: number = Date.now()): ActivityState {
  const state = readRaw();
  if (state.visits.length === 0 && state.savedIds.length === 0) {
    return demoState(now);
  }
  return state;
}

/** Suma una apertura. Ignora la llamada si es la misma ficha, recién contada. */
export function recordVisit(
  place: { id: string; name: string; category: string },
  now: number = Date.now(),
): void {
  const state = readRaw();
  const existing = state.visits.find((v) => v.placeId === place.id);
  if (existing && now - existing.lastAt < DUPLICATE_WINDOW_MS) return;

  const visits = existing
    ? state.visits.map((v) =>
        v.placeId === place.id
          ? { ...v, count: v.count + 1, lastAt: now, name: place.name, category: place.category }
          : v,
      )
    : [
        ...state.visits,
        { placeId: place.id, name: place.name, category: place.category, count: 1, lastAt: now },
      ];

  write({
    visits: visits.sort((a, b) => b.count - a.count || b.lastAt - a.lastAt),
    savedIds: state.savedIds,
    stamps: [...state.stamps, now].slice(-MAX_STAMPS),
  });
}

export function isSaved(placeId: string): boolean {
  return readRaw().savedIds.includes(placeId);
}

/** Guarda o quita de guardados. Devuelve cómo ha quedado. */
export function toggleSaved(placeId: string): boolean {
  const state = readRaw();
  const maintenant = state.savedIds.includes(placeId);
  write({
    visits: state.visits,
    savedIds: maintenant
      ? state.savedIds.filter((id) => id !== placeId)
      : [...state.savedIds, placeId],
    stamps: state.stamps,
  });
  return !maintenant;
}

export function clearActivity(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que hacer: si no se puede borrar, tampoco se pudo escribir.
  }
}

/* ─── Derivadas ───
   Funciones puras sobre el estado. Van aquí y no en el componente para que la
   vista se limite a pintar y esto se pueda comprobar leyéndolo. */

/** N lugares más abiertos. */
export function topVisits(state: ActivityState, limit = 5): PlaceVisit[] {
  return [...state.visits].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function savedVisits(state: ActivityState): PlaceVisit[] {
  return state.savedIds
    .map((id) => state.visits.find((v) => v.placeId === id))
    .filter((v): v is PlaceVisit => v !== undefined);
}

/** Cuántos lugares distintos ha abierto. */
export function placeCount(state: ActivityState): number {
  return state.visits.length;
}

/** La categoría que más repite, o `null` si aún no hay nada. */
export function topCategory(state: ActivityState): { label: string; count: number } | null {
  const totals = new Map<string, number>();
  for (const v of state.visits) {
    totals.set(v.category, (totals.get(v.category) ?? 0) + v.count);
  }
  let best: { label: string; count: number } | null = null;
  for (const [label, count] of totals) {
    if (!best || count > best.count) best = { label, count };
  }
  return best;
}

/**
 * Aperturas por día de los últimos `days` días, del más viejo al más reciente.
 * El último elemento es hoy.
 */
export function dailyHistogram(
  state: ActivityState,
  days = 14,
  now: number = Date.now(),
): number[] {
  const DAY = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayStart = startOfToday.getTime();

  const buckets = new Array<number>(days).fill(0);
  for (const stamp of state.stamps) {
    const dayStart = new Date(stamp);
    dayStart.setHours(0, 0, 0, 0);
    const offset = Math.floor((todayStart - dayStart.getTime()) / DAY);
    if (offset >= 0 && offset < days) {
      // `?? 0` porque el proyecto tiene `noUncheckedIndexedAccess`: para el
      // compilador un índice de array puede no existir, aunque aquí el rango ya
      // esté comprobado.
      const i = days - 1 - offset;
      buckets[i] = (buckets[i] ?? 0) + 1;
    }
  }
  return buckets;
}

/** Iniciales de los días del histograma, para las etiquetas del gráfico. */
export function dayLabels(days = 14, now: number = Date.now()): string[] {
  const DAY = 24 * 60 * 60 * 1000;
  const format = new Intl.DateTimeFormat("es-CU", { weekday: "narrow" });
  return Array.from({ length: days }, (_, i) =>
    format.format(new Date(now - (days - 1 - i) * DAY)),
  );
}

/** Texto relativo de la última visita: "hoy", "ayer", "hace 3 días". */
export function relativeDay(lastAt: number, now: number = Date.now()): string {
  const DAY = 24 * 60 * 60 * 1000;
  const start = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((start(now) - start(lastAt)) / DAY);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem.`;
  return `hace ${Math.floor(days / 30)} meses`;
}
