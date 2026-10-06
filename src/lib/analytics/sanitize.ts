/**
 * Limpieza de lo que entra en un evento.
 *
 * Un evento viene del producto, no de un formulario validado: puede traer un
 * `userId` de 4 000 caracteres, un `resultCount` negativo o un `metadata` con
 * cien claves. Aquí se acota **antes** de tocar la base, para que la tabla no
 * crezca sin control y para que un valor absurdo no ensucie el dashboard.
 *
 * Todo es puro y sin dependencias a propósito: se puede probar sin base de
 * datos ni entorno (`src/lib/analytics/sanitize.test.ts`).
 */

/** Cuánto se guarda cada campo de texto. Un evento es pequeño o no es evento. */
export const MAX_SHORT = 120;
export const MAX_QUERY = 500;
export const MAX_METADATA_KEYS = 8;
const MAX_METADATA_KEY = 40;
const MAX_COUNT = 100_000;

/** Texto limpio y acotado, o `null`. Nunca lanza y nunca guarda el vacío. */
export function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Metadatos mínimos: claves y valores de texto, pocas claves y valores cortos.
 * Si algo necesita más, va a columna — así el jsonb no crece sin control.
 */
export function cleanMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, unknown> = {};
  let keys = 0;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (keys >= MAX_METADATA_KEYS) break;
    const text = clean(raw, MAX_SHORT);
    if (text === null) continue;
    out[key.slice(0, MAX_METADATA_KEY)] = text;
    keys += 1;
  }
  return keys > 0 ? out : null;
}

/** Conteo entero y no negativo: un `resultCount` fuera de rango no significa nada. */
export function cleanCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(Math.round(value), MAX_COUNT));
}
