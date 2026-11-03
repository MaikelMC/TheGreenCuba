/**
 * Los métodos de pago que puede anunciar un negocio.
 *
 * Catálogo cerrado por el mismo motivo que los atributos: la ficha pinta una
 * chapita con la etiqueta y el panel ofrece las mismas opciones. La clave que
 * se guarda en `places.payment_methods` es la que ya usaba el formulario
 * (`MLC`, `CUP`, `USD`, `EUR`, `card`, `transfer`), así que las fichas
 * existentes se siguen leyendo sin migrar nada.
 *
 * Módulo puro: lo leen el panel, la ficha y las pruebas.
 */

export interface MetodoPago {
  clave: string;
  label: string;
}

export const METODOS_PAGO = [
  { clave: "MLC", label: "USD Clásica" },
  { clave: "CUP", label: "CUP" },
  { clave: "USD", label: "USD (efectivo)" },
  { clave: "EUR", label: "EUR" },
  { clave: "card", label: "Tarjeta" },
  { clave: "transfer", label: "Transferencia" },
  { clave: "zelle", label: "Zelle" },
  { clave: "otro", label: "Otro" },
] as const satisfies readonly MetodoPago[];

export type MetodoPagoClave = (typeof METODOS_PAGO)[number]["clave"];

const POR_CLAVE = new Map<string, MetodoPago>(
  METODOS_PAGO.map((m): [string, MetodoPago] => [m.clave, m]),
);

export function esMetodoPago(value: unknown): value is MetodoPagoClave {
  return typeof value === "string" && POR_CLAVE.has(value);
}

/**
 * La etiqueta que se pinta. Si la ficha trae una clave antigua que ya no está
 * en el catálogo se enseña la clave tal cual, en vez de esconder un dato que el
 * dueño sí escribió.
 */
export function etiquetaPago(clave: string): string {
  return POR_CLAVE.get(clave)?.label ?? clave;
}

/** Quita repetidos y deja solo claves conocidas. */
export function normalizarPagos(value: unknown): MetodoPagoClave[] {
  if (!Array.isArray(value)) return [];
  const vistos = new Set<MetodoPagoClave>();
  for (const item of value) {
    if (esMetodoPago(item)) vistos.add(item);
  }
  return [...vistos];
}
