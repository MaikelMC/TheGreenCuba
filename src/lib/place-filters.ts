import { haversineM } from "@/lib/map/routing";
import { tieneRespaldo } from "@/lib/energia";
import { estadoAhora, estadoDesdeTexto } from "@/lib/ficha/horario";
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

export const PLACE_FILTERS = [
  "distancia",
  "abierto",
  "energia",
  "tranquilo",
  "musica",
] as const;

export type PlaceFilter = (typeof PLACE_FILTERS)[number];

/**
 * Radio de «Cercanos». La app es de barrio: en Santiago casi todo lo que busca
 * un usuario se resuelve dentro de este radio, y 3 km deja fuera las playas y
 * el Gran Piedra, que es justo lo que se espera al pedir «cercanos».
 */
export const NEARBY_RADIUS_M = 3000;

/**
 * «Abiertos ahora» a partir del horario en texto libre.
 *
 * Lo que no se puede leer cuenta como abierto: el filtro sirve para **quitar**
 * negocios del mapa y no se quita uno por no saber interpretar su horario. La
 * ficha es la que no afirma nada cuando el texto no da una hora comprobable.
 */
export function isOpenNow(schedule: string, now: Date): boolean {
  return estadoDesdeTexto(schedule, now).estado !== "cerrado";
}

/**
 * El estado real del negocio para los filtros: manda el horario estructurado y,
 * solo cuando no lo hay, el texto libre. Antes se miraba únicamente `schedule`,
 * así que un negocio con horario por día se colaba en «Abiertos ahora» a las
 * tres de la mañana.
 */
function estaAbiertoAhora(place: UserPlace, now: Date): boolean {
  if (place.horario) {
    return (
      estadoAhora({
        horario: place.horario,
        schedule: place.schedule,
        status: place.status,
        now,
      }) === "abierto"
    );
  }
  return isOpenNow(place.schedule, now);
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

  /* Un solo chip para las tres formas de respaldo —planta, inversor y ambas—:
     quien pregunta por «corriente» quiere cualquiera de las tres, y separarlas
     obligaría a marcar dos casillas para ver el mapa entero. Un negocio que
     dijo «ninguna» y uno que no lo dijo se filtran igual: fuera. */
  if (ctx.filters.has("energia") && !tieneRespaldo(place.energiaRespaldo)) {
    return false;
  }

  const vibe = place.vibe ?? [];
  if (ctx.filters.has("tranquilo") && !vibe.includes("Tranquilo")) return false;
  if (ctx.filters.has("musica") && !vibe.includes("Musical")) return false;
  if (ctx.filters.has("abierto") && !estaAbiertoAhora(place, ctx.now)) {
    return false;
  }

  if (ctx.filters.has("distancia")) {
    /* Sin ubicación del usuario no hay desde dónde medir. Devolver `false` aquí
       vaciaría el mapa entero y el usuario no sabría por qué; el chip se pinta
       deshabilitado mientras no haya ubicación. */
    if (!ctx.origin) return true;
    if (haversineM(ctx.origin, place) > NEARBY_RADIUS_M) return false;
  }

  return true;
}
