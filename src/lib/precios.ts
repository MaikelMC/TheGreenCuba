/**
 * Helpers puros de conversión de precios con tasa del día.
 *
 * Importable en cliente y servidor. Sin acceso a la base ni a la red.
 * Reutiliza `precioDeLinea` de `src/lib/pedido.ts` para detectar cifras puras.
 */

import { precioDeLinea } from "./pedido";
import { currencyLabel } from "./utils";

/** Config de la tasa tal como la reciben los componentes. */
export interface ConfigTasa {
  tasaUsdCup: number;
  tasaRedondeo: number;
  tasaActualizadaEn: Date | null;
}

/** Un producto de la carta reducido a lo que hace falta para convertir. */
export interface ItemConvertible {
  price: string;
  currency: string;
}

/**
 * Redondea `valor` hacia arriba al múltiplo de `multiplo`.
 * `Math.ceil(valor / multiplo) * multiplo`, con protección para multiplo = 0.
 */
export function aplicarTasa(
  valorUsd: number,
  tasa: number,
  redondeo: number,
): number {
  const cup = valorUsd * tasa;
  const m = redondeo > 0 ? redondeo : 1;
  return Math.ceil(cup / m) * m;
}

/**
 * Formatea un valor en CUP con separador de miles (mismo estilo que `textoCup`
 * de `plans.ts`, pero sin el `toLocaleString` dependiente de locale: aquí
 * usamos `Intl.NumberFormat("en-US")` fijo, igual que `formatMenuPrice`,
 * para que SSR y cliente coincidan).
 */
export function formatCup(valor: number): string {
  return `${new Intl.NumberFormat("en-US").format(valor)} CUP`;
}

/**
 * El precio de un item de la carta, con su equivalente en CUP si aplica.
 *
 * Reglas:
 * - Sin config o `currency` no es USD → `{ principal }` sin `cup`.
 * - `currency` USD y `price` numérico puro → `{ principal, cup }`.
 * - `currency` CUP → `{ principal }` sin conversión (ya está en CUP).
 * - EUR / MLC → `{ principal }` sin conversión por ahora.
 * - Precio no numérico («3–5 USD», «A convenir») → `{ principal }` sin `cup`.
 *
 * `principal` es la cadena ya formateada para mostrar (precio + moneda);
 * `cup` es la cadena CUP lista para mostrar («1.750 CUP»).
 */
export function preciosDeItem(
  item: ItemConvertible,
  config: ConfigTasa | null,
): { principal: string; secundario?: string } {
  const { price, currency } = item;
  const principal = price.trim()
    ? currency === "CUP"
      ? `${price} CUP`
      : `${price} ${currencyLabel(currency)}`
    : "";

  if (!config) return { principal };

  const valor = precioDeLinea(price);
  if (valor === null) return { principal };

  if (currency === "CUP") {
    /* CUP → USD: el cliente ve cuánto es en dólares. */
    const usd = valor / config.tasaUsdCup;
    const secundario = `${usd.toFixed(2)} USD`;
    return { principal, secundario };
  }

  if (currency === "USD" || currency === "MLC") {
    /* USD/MLC → CUP: el cliente ve cuánto es en pesos. */
    const secundario = formatCup(aplicarTasa(valor, config.tasaUsdCup, config.tasaRedondeo));
    return { principal, secundario };
  }

  return { principal };
}

/** Los valores permitidos para `tasa_redondeo`. */
export const REDONDEOS_PERMITIDOS = [1, 5, 10, 50, 100] as const;
export type Redondeo = (typeof REDONDEOS_PERMITIDOS)[number];
