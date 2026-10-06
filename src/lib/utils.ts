import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

const MONTH_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/**
 * Las fechas de un proyecto, legibles.
 *
 * La base las guarda como `YYYY-MM-DD` —salen de un `<input type="date">`— y la
 * API las une en una cadena «2026-08-12 a 2026-08-20» que viajaba cruda a la
 * ficha. Ese es el dato por el que se decide si ir a un proyecto, así que se
 * enseña como se lee: «12 ago – 20 ago», o «12 ago 2026 – 20 ago 2026» cuando
 * cruza de año, porque ahí el año ya no es el mismo para las dos.
 *
 * Sin `Date`: `new Date("2026-08-12")` se interpreta como UTC y en un navegador
 * al oeste de Greenwich devuelve el día anterior. La cadena ya viene partida, así
 * que se formatea a mano y no hay huso que la mueva.
 *
 * Lo que no encaje —otro separador, un texto escrito a mano— se devuelve tal
 * cual: es preferible una fecha fea a una fecha inventada.
 */
export function formatDateRange(value: string): string {
  const [start, end] = value.split(/\s+a\s+/);
  if (!start || !end) return value;

  const parts = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    if (!year || !month || !day || month > 12) return null;
    return `${day} ${MONTH_SHORT[month - 1]}`;
  };

  const from = parts(start);
  const to = parts(end);
  if (!from || !to) return value;

  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const year = sameYear ? "" : ` ${start.slice(0, 4)}`;
  const yearTo = sameYear ? "" : ` ${end.slice(0, 4)}`;
  return `${from}${year} – ${to}${yearTo}`;
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
  MLC: "bg-verde-100 text-verde-700 ring-verde-300/70",
  CUP: "bg-verde-50 text-verde-600 ring-verde-200/80",
  USD: "bg-sand-deep text-ink-soft ring-ink/10",
  EUR: "bg-sand-deep text-ink-soft ring-ink/10",
};

/**
 * Un teléfono solo lleva dígitos y los separadores con los que se escribe
 * («+53 5 123 4567», «(7) 866-1234»). Hace falta cribar porque `type="tel"` no
 * rechaza nada: solo cambia el teclado del móvil. Sin esto el campo acepta
 * «llámame por la tarde» y ese texto acaba en la ficha pública.
 */
export function sanitizePhone(value: string): string {
  return value.replace(/[^\d+\s().-]/g, "");
}

export function formatMenuPrice(price: string, currency: string): string {
  return price.trim() ? `${price} ${currencyLabel(currency)}` : "";
}

export function formatPrice(price: number, currency = "MLC"): string {
  const symbols: Record<string, string> = {
    MLC: "USD",
    CUP: "$",
    USD: "USD",
    EUR: "€",
  };
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
