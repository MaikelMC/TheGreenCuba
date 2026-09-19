import { haversineM } from "@/lib/map/routing";
import type { UserPlace } from "@/lib/places-store";

/**
 * Los filtros del mapa del home.
 *
 * Viven aquí —y no dentro de la pantalla— porque los comparten tres sitios: los
 * chips que los encienden, la lista del panel inferior y los pines del mapa. Si
 * cada uno tuviera su copia, el pin y la tarjeta del mismo negocio podrían
 * discrepar.
 *
 * El filtro de categoría va aparte, por parámetro y no dentro del conjunto:
 * las categorías son excluyentes entre sí (una sola activa) y el resto de
 * filtros son acumulables. Mezclarlos en el mismo `Set` haría que «Cafeterías»
 * y «Restaurantes» a la vez no devolviera nada.
 */

export const PLACE_FILTERS = ["distancia", "abierto", "tranquilo", "musica"] as const;

export type PlaceFilter = (typeof PLACE_FILTERS)[number];

/**
 * Radio de «Cercanos». La app es de barrio: en Santiago casi todo lo que busca
 * un usuario se resuelve dentro de este radio, y 3 km deja fuera las playas y
 * el Gran Piedra, que es justo lo que se espera al pedir «cercanos».
 */
export const NEARBY_RADIUS_M = 3000;

/*
 * «Abiertos ahora» a partir de `schedule`.
 *
 * `ponytail:` esto es una aproximación por franjas, no un horario. El campo es
 * texto libre y en la base solo tiene tres valores reales —«De día», «De noche»
 * y «Todo el día»—; el horario estructurado (`hours_json`, tabla
 * `place_hours`) está vacío y sin usar. Con esos tres valores un cubo por
 * franja horaria es lo único honesto que se puede hacer. Subir a horarios de
 * verdad cuando el panel de negocio los recoja.
 */
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 19;

/** Sin dato o con texto irreconocible devuelve `true`: no se descarta nada por
    no entenderlo, que sería esconder negocios sin motivo. */
export function isOpenNow(schedule: string, now: Date): boolean {
  const text = schedule.trim().toLowerCase();
  if (!text) return true;
  if (text.includes("todo el día") || text.includes("todo el dia")) return true;

  const hour = now.getHours();
  const isDaytime = hour >= DAY_START_HOUR && hour < DAY_END_HOUR;

  if (text.includes("de día") || text.includes("de dia")) return isDaytime;
  if (text.includes("de noche")) return !isDaytime;
  return true;
}

export interface FilterContext {
  /** Etiqueta de la categoría activa («Restaurante»), o `null` para «Todo». */
  categoryLabel: string | null;
  filters: ReadonlySet<string>;
  origin: { lat: number; lng: number } | null;
  now: Date;
}

export function matchesPlaceFilters(place: UserPlace, ctx: FilterContext): boolean {
  if (ctx.categoryLabel && place.category !== ctx.categoryLabel) return false;

  const vibe = place.vibe ?? [];
  if (ctx.filters.has("tranquilo") && !vibe.includes("Tranquilo")) return false;
  if (ctx.filters.has("musica") && !vibe.includes("Musical")) return false;
  if (ctx.filters.has("abierto") && !isOpenNow(place.schedule, ctx.now)) return false;

  if (ctx.filters.has("distancia")) {
    /* Sin ubicación del usuario no hay desde dónde medir. Devolver `false` aquí
       vaciaría el mapa entero y el usuario no sabría por qué; el chip se pinta
       deshabilitado mientras no haya ubicación. */
    if (!ctx.origin) return true;
    if (haversineM(ctx.origin, place) > NEARBY_RADIUS_M) return false;
  }

  return true;
}
