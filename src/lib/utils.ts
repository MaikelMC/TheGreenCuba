import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Etiqueta visible de una moneda. MLC se muestra como "USD Clásica"
 * (mantenemos el valor interno "MLC" para compatibilidad con datos guardados).
 */
export function currencyLabel(code: string): string {
  const labels: Record<string, string> = {
    MLC: "USD Clásica",
    CUP: "CUP",
    USD: "USD",
    EUR: "EUR",
  };
  return labels[code] ?? code;
}

/**
 * El precio de una entrada de la carta, tal como lo escribió el dueño:
 * «12 USD Clásica». **Cadena vacía si no hay precio.**
 *
 * Existe porque el precio puede faltar —un servicio como «Wi-Fi gratis» no
 * tiene— y las vistas que pintan la carta lo escribían a mano, así que la ficha
 * enseñaba « USD Clásica»: con el espacio delante y la moneda de un precio que
 * no existe. Hoy solo la usa `MenuItem`, pero el caso sigue ahí: el precio es
 * texto libre y puede venir vacío.
 */
/**
 * Colores de la chapita de moneda. La moneda no se distingue por color —el
 * rótulo ya la dice— así que todas bajan a la escala verde/arena del sistema.
 * Antes eran lv-blue y lv-teal, que no son del sistema.
 *
 * Vive aquí y no en cada ficha porque son dos —`InfoBar` y `PlaceDetail`— y
 * tenían el mapa copiado: cualquier ajuste había que hacerlo dos veces.
 */
export const currencyStyles: Record<string, string> = {
  MLC: "bg-verde-100 text-verde-700",
  CUP: "bg-verde-50 text-verde-600",
  USD: "bg-sand-deep text-ink-soft/75",
  EUR: "bg-sand-deep text-ink-soft/75",
};

export function formatMenuPrice(price: string, currency: string): string {
  return price.trim() ? `${price} ${currencyLabel(currency)}` : "";
}

export function formatPrice(price: number, currency = "MLC"): string {
  const symbols: Record<string, string> = { MLC: "USD", CUP: "$", USD: "USD", EUR: "€" };
  return `${price.toFixed(2)} ${symbols[currency] ?? currency}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function generateId(): string {
  const { nanoid } = require("nanoid");
  return nanoid(12);
}
