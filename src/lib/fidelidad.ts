/**
 * Reglas puras de la tarjeta de cliente frecuente.
 *
 * Sin base de datos ni React: lo leen el servidor, el panel y los tests. Aquí
 * viven la forma de la configuración, cuándo un pedido da sello, qué premio
 * está listo y cómo se mueve la tarjeta al canjear o revertir.
 *
 * La tarjeta es una sola: `sellos` es el ciclo actual y las metas son hitos
 * dentro de esa tarjeta. Las metas intermedias **no restan sellos** —si el
 * refresco de 5 restara, el combo de 10 sería inalcanzable—; la última es la
 * que cierra la tarjeta y la reinicia.
 */

import type { Monto } from "./ficha/entrega";

/** Un hito de la tarjeta: cuántos sellos y qué premio. */
export interface MetaSello {
  /** Sellos necesarios dentro del ciclo. Entero positivo. */
  sellos: number;
  /** Lo que se lleva el cliente. Texto corto para el panel y WhatsApp. */
  premio: string;
}

/** Lo que el negocio configura en `places.fidelidad`. */
export interface FidelidadConfig {
  activo: boolean;
  /** «Tarjeta de cliente frecuente» por defecto. */
  nombre: string;
  /** Entre 1 y 4, en orden creciente de sellos. La última cierra la tarjeta. */
  metas: MetaSello[];
  /** El pedido tiene que llegar a este total para dar sello. `null` = sin mínimo. */
  compraMinima: Monto | null;
}

/** Lo que se enseña cuando el negocio activa la tarjeta por primera vez. */
export const FIDELIDAD_DEFAULT: FidelidadConfig = {
  activo: false,
  nombre: "Tarjeta de cliente frecuente",
  metas: [{ sellos: 5, premio: "Un premio gratis" }],
  compraMinima: null,
};

export const MAX_METAS = 4;
export const MAX_SELLOS_META = 100;
/** Máximo de casillas en la tarjeta (última meta). */
export const MAX_SELLOS_TOTAL = 20;
export const MAX_NOMBRE_TARJETA = 60;
export const MAX_PREMIO = 80;

/* ── validación ─────────────────────────────────────────────────────────── */

function esMonto(value: unknown): value is Monto {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<Monto>;
  return (
    typeof m.monto === "number" &&
    Number.isFinite(m.monto) &&
    m.monto >= 0 &&
    typeof m.moneda === "string" &&
    m.moneda.trim().length > 0
  );
}

function textoNoVacio(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
}

/**
 * Valida la configuración completa antes de guardarla.
 *
 * Rechaza en vez de corregir: dos metas con los mismos sellos dejarían al
 * cliente sin saber cuál le toca, y una tarjeta sin metas no daría nunca un
 * premio. El nombre vacío se rechaza porque es el título de la tarjeta.
 */
export function esFidelidadConfig(value: unknown): value is FidelidadConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const f = value as Partial<FidelidadConfig>;

  if (typeof f.activo !== "boolean") return false;
  if (!textoNoVacio(f.nombre, MAX_NOMBRE_TARJETA)) return false;

  if (!Array.isArray(f.metas)) return false;
  if (f.metas.length < 1 || f.metas.length > MAX_METAS) return false;

  let anterior = 0;
  for (const meta of f.metas) {
    if (!meta || typeof meta !== "object") return false;
    const m = meta as Partial<MetaSello>;
    if (
      typeof m.sellos !== "number" ||
      !Number.isInteger(m.sellos) ||
      m.sellos < 1 ||
      m.sellos > MAX_SELLOS_META
    ) {
      return false;
    }
    if (m.sellos <= anterior) return false;
    anterior = m.sellos;
    if (!textoNoVacio(m.premio, MAX_PREMIO)) return false;
  }

  if (f.compraMinima !== null && !esMonto(f.compraMinima)) return false;

  return true;
}

/* ── la tarjeta ─────────────────────────────────────────────────────────── */

export interface MetaEstado extends MetaSello {
  /** `sellos >= meta.sellos`. */
  alcanzada: boolean;
  /** Ya se canjeó en este ciclo. */
  canjeada: boolean;
  /** Sellos que faltan. `0` si ya está alcanzada. */
  faltan: number;
}

export interface EstadoTarjeta {
  config: FidelidadConfig;
  /** Sellos del ciclo actual, sin recortar al último hito. */
  sellos: number;
  ciclo: number;
  metas: MetaEstado[];
  /** La meta más cercana que aún no se alcanzó y no se canjeó. */
  siguiente: MetaEstado | null;
  /** Metas alcanzadas y sin canjear, de la primera a la última. */
  listas: MetaEstado[];
  /** El último hito: el que cierra la tarjeta. */
  metaFinal: MetaSello;
}

/**
 * La tarjeta tal como se pinta, con las metas y lo que falta.
 *
 * `canjeadas` son los índices de meta ya canjeados **en el ciclo actual**; los
 * canjes de ciclos anteriores no cuentan. No se recorta `sellos`: si el cliente
 * llegó a 12 con meta final de 10, los dos sobrantes se ven al reiniciar y el
 * panel puede enseñarlos.
 */
export function estadoTarjeta(
  config: FidelidadConfig,
  sellos: number,
  ciclo: number,
  canjeadas: readonly number[] = [],
): EstadoTarjeta {
  const yaCanjeadas = new Set(canjeadas);
  const metas: MetaEstado[] = config.metas.map((meta, indice) => {
    const alcanzada = sellos >= meta.sellos;
    return {
      ...meta,
      alcanzada,
      canjeada: yaCanjeadas.has(indice),
      faltan: Math.max(0, meta.sellos - sellos),
    };
  });

  const listas = metas.filter((m) => m.alcanzada && !m.canjeada);
  const siguiente = metas.find((m) => !m.alcanzada && !m.canjeada) ?? null;
  const metaFinal = config.metas[config.metas.length - 1]!;

  return { config, sellos, ciclo, metas, siguiente, listas, metaFinal };
}

/* ── sellos ─────────────────────────────────────────────────────────────── */

/**
 * Si el pedido cumple la compra mínima.
 *
 * Devuelve `null` cuando no se puede comprobar —no hay total, o la moneda no
 * se puede convertir—: quien llama decide no sumar sello y decirlo. Compara en
 * la moneda del pedido y, si difiere, convierte con la tasa guardada en ese
 * pedido. USD y MLC se tratan como la misma familia de dólar.
 */
export function cumpleCompraMinima(
  total: { total: number; currency: string } | null,
  minimo: Monto | null,
  tasaUsdCup: number | null | undefined,
): boolean | null {
  if (!minimo) return true;
  if (!total) return null;

  const monedaTotal = total.currency.trim().toUpperCase();
  const monedaMin = minimo.moneda.trim().toUpperCase();
  if (!monedaTotal || !monedaMin) return null;

  if (monedaTotal === monedaMin) return total.total >= minimo.monto;

  const esDolar = (m: string) => m === "USD" || m === "MLC";
  const tasa = typeof tasaUsdCup === "number" && Number.isFinite(tasaUsdCup) && tasaUsdCup > 0
    ? tasaUsdCup
    : null;
  if (!tasa) return null;

  if (esDolar(monedaTotal) && monedaMin === "CUP") {
    return total.total * tasa >= minimo.monto;
  }
  if (monedaTotal === "CUP" && esDolar(monedaMin)) {
    return total.total / tasa >= minimo.monto;
  }
  return null;
}

/** Un sello más. No hay tope: los sobrantes se conservan para el reinicio. */
export function sumarSello(sellos: number): number {
  return Math.max(0, sellos) + 1;
}

/** Una reversión de un sello, sin dejar la tarjeta en negativo. */
export function restarSello(sellos: number): number {
  return Math.max(0, sellos - 1);
}

export interface ResultadoCanje {
  /** Sellos del ciclo después del canje. */
  sellos: number;
  /** Ciclo después del canje. */
  ciclo: number;
  /** Lo que se apunta en el movimiento. `0` si la meta es intermedia. */
  cantidad: number;
  /** Si la última meta reinició la tarjeta. */
  reinicio: boolean;
}

/**
 * Canjea una meta.
 *
 * Las intermedias no mueven sellos: son un hito que se cobra una vez por ciclo.
 * La última resta sus sellos, sube el ciclo y deja los sobrantes en la tarjeta
 * nueva. Devuelve `null` si la meta no existe, no está alcanzada o ya se
 * canjeó en este ciclo.
 */
export function aplicarCanje(
  config: FidelidadConfig,
  sellos: number,
  ciclo: number,
  metaIndice: number,
  canjeadas: readonly number[] = [],
): ResultadoCanje | null {
  const meta = config.metas[metaIndice];
  if (!meta) return null;
  if (sellos < meta.sellos) return null;
  if (canjeadas.includes(metaIndice)) return null;

  const esUltima = metaIndice === config.metas.length - 1;
  if (!esUltima) {
    return { sellos, ciclo, cantidad: 0, reinicio: false };
  }

  return {
    sellos: Math.max(0, sellos - meta.sellos),
    ciclo: ciclo + 1,
    cantidad: -meta.sellos,
    reinicio: true,
  };
}

/**
 * El texto de «cuánto falta» para la carta y el panel.
 * `null` si ya no hay siguiente meta.
 *
 * Formato: «Próximo premio: X · te falta/faltan N sello/s» para evitar pegar
 * el nombre del premio con mayúscula a mitad de frase.
 */
export function textoFalta(estado: EstadoTarjeta): string | null {
  if (!estado.siguiente) return null;
  const { faltan, premio } = estado.siguiente;
  const cuenta = faltan === 1 ? "te falta 1 sello" : `te faltan ${faltan} sellos`;
  return `Próximo premio: ${premio} · ${cuenta}`;
}
