/**
 * Lectura de la respuesta de CambioCUP, sin red y sin Next.
 *
 * CambioCUP —el servicio de tasa de QvaPay— publica en `/api` las últimas
 * muestras por moneda. La forma que interesa es:
 *
 * ```json
 * { "cupHistory": [{ "updated_at": "2026-11-10T23:20:19Z", "value": 1083.32 }] }
 * ```
 *
 * También se acepta la forma de `/api/v1/history` (`data: [{ time, value }]`)
 * para que el mismo lector sirva si mañana se cambia el endpoint. Aquí no se
 * lanza nada: cualquier cosa que no sea una tasa válida devuelve `null` y quien
 * llama se queda con la tasa de respaldo.
 */

/** Una tasa de mercado ya validada. `actualizadaEn` va en ISO, no en `Date`:
 *  así cruza la caché de Next y la frontera servidor/cliente sin sorpresas. */
export interface TasaMercado {
  usdCup: number;
  actualizadaEn: string | null;
}

/** Debajo de 1 no es una tasa; por encima de 100.000, un error de formato. */
export const TASA_MERCADO_MIN = 1;
export const TASA_MERCADO_MAX = 100_000;

/** Un número finito, o `null`. Acepta número y cadena numérica. */
function numero(valor: unknown): number | null {
  const n =
    typeof valor === "number"
      ? valor
      : typeof valor === "string" && valor.trim()
        ? Number(valor)
        : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

/** Una fecha ISO válida, o `null`. Se normaliza a ISO para compararla. */
function fecha(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor.trim()) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * La última tasa del CUP en la respuesta, o `null`.
 *
 * Se elige la fila con `updated_at`/`time` más reciente, no la primera: la API
 * las devuelve ordenadas, pero depender del orden es frágil. Si ninguna fila
 * trae fecha, se queda la primera válida.
 */
export function leerTasaCambio(payload: unknown): TasaMercado | null {
  if (typeof payload !== "object" || payload === null) return null;
  const obj = payload as Record<string, unknown>;

  const filas = Array.isArray(obj.cupHistory)
    ? obj.cupHistory
    : Array.isArray(obj.data)
      ? obj.data
      : null;
  if (!filas) return null;

  let elegida: TasaMercado | null = null;

  for (const fila of filas) {
    if (typeof fila !== "object" || fila === null) continue;
    const f = fila as Record<string, unknown>;

    const valor = numero(f.value);
    if (
      valor === null ||
      valor < TASA_MERCADO_MIN ||
      valor > TASA_MERCADO_MAX
    ) {
      continue;
    }

    const actualizadaEn = fecha(f.updated_at) ?? fecha(f.time);
    const candidata: TasaMercado = { usdCup: valor, actualizadaEn };

    if (
      !elegida ||
      (actualizadaEn !== null &&
        (elegida.actualizadaEn === null ||
          Date.parse(actualizadaEn) > Date.parse(elegida.actualizadaEn)))
    ) {
      elegida = candidata;
    }
  }

  return elegida;
}
