/**
 * Los atributos que puede anunciar un negocio.
 *
 * Catálogo cerrado a propósito: la ficha pinta estos como distintivos, así que
 * una clave libre acabaría en un texto que nadie entiende o en un hueco. Cada
 * atributo dice en qué tipos se sugiere; el dueño solo ve los suyos, pero
 * ninguno está prohibido en otro tipo (una tienda puede tener wifi).
 *
 * `planta_electrica` **no está aquí**: se deriva de `energia_respaldo` para que
 * no existan dos verdades sobre lo mismo. Ver `src/lib/energia.ts`.
 *
 * Módulo puro: lo leen el panel, la ficha y las pruebas.
 */

import { FAMILIAS_NEGOCIO, familiaDe, type FamiliaNegocio, type TipoNegocio } from "./tipos";

export interface Atributo {
  clave: string;
  label: string;
  /** Nombre del icono de Lucide que se pinta en el distintivo. */
  icono: string;
  /** Familias en las que se sugiere. Nunca es una restricción. */
  tipos: readonly FamiliaNegocio[];
}

const TODOS = FAMILIAS_NEGOCIO;

/**
 * El catálogo. El orden es el que se enseña en el panel, de lo más común a lo
 * más específico.
 */
export const ATRIBUTOS = [
  { clave: "wifi", label: "WiFi", icono: "Wifi", tipos: TODOS },
  { clave: "terraza", label: "Terraza", icono: "Sun", tipos: TODOS },
  { clave: "climatizado", label: "Climatizado", icono: "Snowflake", tipos: TODOS },
  { clave: "musica", label: "Música", icono: "Music", tipos: TODOS },
  { clave: "estacionamiento", label: "Estacionamiento", icono: "CircleParking", tipos: TODOS },
  { clave: "pet_friendly", label: "Pet friendly", icono: "PawPrint", tipos: TODOS },
  { clave: "vegetariano", label: "Opciones vegetarianas", icono: "Leaf", tipos: TODOS },
  { clave: "enchufes", label: "Enchufes", icono: "Plug", tipos: TODOS },
  { clave: "accesible", label: "Accesible", icono: "Accessibility", tipos: TODOS },
  { clave: "zona_fumadores", label: "Zona para fumadores", icono: "Cigarette", tipos: TODOS },
  { clave: "servicio_en_mesa", label: "Servicio en mesa", icono: "UtensilsCrossed", tipos: ["cafeteria_restaurante"] },
  { clave: "para_llevar", label: "Para llevar", icono: "ShoppingBag", tipos: ["cafeteria_restaurante", "comida_domicilio"] },
  { clave: "reservas_grupos", label: "Reservas para grupos", icono: "Users", tipos: ["cafeteria_restaurante"] },
  { clave: "barra", label: "Barra", icono: "Beer", tipos: ["cafeteria_restaurante"] },
  { clave: "vista", label: "Con vista", icono: "Mountain", tipos: ["cafeteria_restaurante"] },
  { clave: "recoger_en_tienda", label: "Recoger en tienda", icono: "Store", tipos: ["tienda_mipyme"] },
  { clave: "apartar_whatsapp", label: "Apartar por WhatsApp", icono: "MessageCircle", tipos: ["tienda_mipyme"] },
  { clave: "mayorista", label: "Venta mayorista", icono: "Boxes", tipos: ["tienda_mipyme"] },
  { clave: "con_cita", label: "Con cita", icono: "CalendarCheck", tipos: ["servicios"] },
  { clave: "sin_cita", label: "Sin cita", icono: "CalendarClock", tipos: ["servicios"] },
  { clave: "a_domicilio", label: "A domicilio", icono: "Truck", tipos: ["servicios", "comida_domicilio"] },
  { clave: "garantia", label: "Con garantía", icono: "ShieldCheck", tipos: ["servicios"] },
] as const satisfies readonly Atributo[];

export type AtributoClave = (typeof ATRIBUTOS)[number]["clave"];

const POR_CLAVE = new Map<string, Atributo>(
  ATRIBUTOS.map((a): [string, Atributo] => [a.clave, a]),
);

/** Valida en la frontera lo que llega por HTTP. */
export function esAtributo(value: unknown): value is AtributoClave {
  return typeof value === "string" && POR_CLAVE.has(value);
}

/**
 * Quita repetidos y claves desconocidas, conservando el orden elegido.
 *
 * Una clave que ya no está en el catálogo se descarta en vez de guardarse: si
 * se colara, la ficha no sabría qué pintar y el panel no sabría cómo editarle
 * la etiqueta.
 */
export function normalizarAtributos(value: unknown): AtributoClave[] {
  if (!Array.isArray(value)) return [];
  const vistos = new Set<AtributoClave>();
  for (const item of value) {
    if (esAtributo(item)) vistos.add(item);
  }
  return [...vistos];
}

/** La etiqueta que se pinta, o `null` si la clave no existe. */
export function etiquetaAtributo(clave: string): string | null {
  return POR_CLAVE.get(clave)?.label ?? null;
}

/** El icono de Lucide, o `null` si la clave no existe. */
export function iconoAtributo(clave: string): string | null {
  return POR_CLAVE.get(clave)?.icono ?? null;
}

/** Los atributos sugeridos para un tipo, en el orden del catálogo. */
export function atributosParaTipo(tipo: TipoNegocio | null | undefined): Atributo[] {
  if (!tipo) return ATRIBUTOS.filter(() => true);
  const familia = familiaDe(tipo);
  return ATRIBUTOS.filter((a) => a.tipos.some((t) => t === familia));
}
