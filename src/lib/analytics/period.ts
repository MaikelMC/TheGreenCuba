/**
 * El calendario del dashboard: días UTC y periodos.
 *
 * Todas las columnas de analítica son UTC —`created_at` es `timestamptz`, y los
 * agregados usan `date_trunc('day', …)`—, así que el navegador y el servidor
 * tienen que hablar el mismo día. De ahí que esto viva separado y sin
 * dependencias: es la misma aritmética en el cliente (el selector de periodo) y
 * en el servidor (la consulta), y se prueba directamente
 * (`src/lib/analytics/period.test.ts`).
 */

/** Fecha UTC «YYYY-MM-DD», que es como hablan las columnas del dashboard. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Presets del selector. `custom` no tiene rango propio: lo pone el usuario. */
export type PeriodPreset = "today" | "7d" | "30d" | "90d" | "year";

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 366;

/**
 * Normaliza el periodo. Sin fechas válidas, últimos 30 días. Se recorta el
 * rango a 366 días: un `from` de hace diez años no debe convertirse en un scan
 * de toda la tabla.
 */
export function normalizePeriod(
  from?: string | null,
  to?: string | null,
): {
  from: string;
  to: string;
} {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const today = isoDay(new Date());
  const end = to && day.test(to) ? to : today;
  const start =
    from && day.test(from)
      ? from
      : isoDay(
          new Date(new Date(`${end}T00:00:00.000Z`).getTime() - 29 * DAY_MS),
        );

  const startMs = new Date(`${start}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${end}T00:00:00.000Z`).getTime();
  const capped = Math.max(startMs, endMs - 365 * DAY_MS);
  return {
    from: isoDay(new Date(Math.min(capped, endMs))),
    to: isoDay(new Date(Math.max(capped, endMs))),
  };
}

/**
 * Rango de fechas de un preset. Todo en UTC, como las columnas.
 *
 * «7d» son los últimos 7 días **contando hoy**, no ocho: el día de hoy entra en
 * el rango, y por eso se retrocede `días - 1`. Si no, la pestaña «Hoy» sería
 * «hoy y ayer».
 */
export function presetRange(preset: PeriodPreset): { from: string; to: string } {
  const now = new Date();
  const to = isoDay(now);
  const back = (days: number) => isoDay(new Date(now.getTime() - days * DAY_MS));
  switch (preset) {
    case "today":
      return { from: to, to };
    case "7d":
      return { from: back(6), to };
    case "90d":
      return { from: back(89), to };
    case "year":
      return { from: `${now.getUTCFullYear()}-01-01`, to };
    case "30d":
    default:
      return { from: back(29), to };
  }
}

/** Nº máximo de días de un rango. Es el recorte que aplica `normalizePeriod`. */
export const PERIOD_MAX_DAYS = MAX_RANGE_DAYS;
