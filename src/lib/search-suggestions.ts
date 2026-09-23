import { formatDistanceM, haversineM, type RoutePoint } from "@/lib/map/routing";
import type { UserPlace } from "@/lib/places-store";

/**
 * Sugerencias del buscador, sacadas del catálogo real.
 *
 * Antes eran dos frases escritas a mano en el componente, con un barrio
 * inventado debajo («Restaurante · Bahía»): se ofrecía «restaurante con vista al
 * mar» aunque no hubiera ninguno. Ahora cada fila nace de los negocios que hay
 * de verdad alrededor del usuario, y la segunda línea enseña el recuento y la
 * distancia reales en vez de un adorno.
 */

/** Radio en el que un negocio cuenta como «cerca»: una ciudad y su extrarradio. */
const NEAR_RADIUS_M = 25_000;

/** Tope de filas: con tres el desplegable sigue siendo un desplegable. */
const MAX_SUGGESTIONS = 3;

export interface SearchSuggestion {
  /** Lo que se manda a la búsqueda con IA. */
  query: string;
  /** Lo que se lee en la fila. */
  label: string;
  /** Segunda línea: contexto medido, nunca inventado. */
  detail: string;
  /** Etiqueta de la categoría en el catálogo, para resolver su icono. */
  category: string;
}

export interface SuggestionInput {
  places: UserPlace[];
  origin: RoutePoint;
  /**
   * `true` solo si `origin` es la posición real del usuario. Con el centro de la
   * ciudad como origen —el caso de quien todavía no ha dado permiso de
   * ubicación— la fila no promete cercanía: decir «a 320 m de ti» desde un punto
   * que no es el usuario sería mentir con un número.
   */
  originIsUserPosition: boolean;
  /** Ciudad del onboarding, para la fila cuando el origen no es el usuario. */
  cityLabel: string;
}

export function buildSearchSuggestions({
  places,
  origin,
  originIsUserPosition,
  cityLabel,
}: SuggestionInput): SearchSuggestion[] {
  const near = places
    .map((place) => ({
      place,
      distanceM: haversineM(origin, { lat: place.lat, lng: place.lng }),
    }))
    .filter((x) => x.distanceM <= NEAR_RADIUS_M)
    .sort((a, b) => a.distanceM - b.distanceM);

  /* Categorías por lo que hay alrededor, no por lo que hay en el catálogo: una
     categoría con veinte negocios a 800 km no es una sugerencia para alguien
     que está aquí. */
  const byCategory = new Map<string, { count: number; nearestM: number }>();
  for (const { place, distanceM } of near) {
    const entry = byCategory.get(place.category);
    if (entry) {
      entry.count += 1;
      entry.nearestM = Math.min(entry.nearestM, distanceM);
    } else {
      byCategory.set(place.category, { count: 1, nearestM: distanceM });
    }
  }

  return [...byCategory.entries()]
    // Más negocios primero; a igualdad, la categoría que tiene algo más cerca.
    .sort((a, b) => b[1].count - a[1].count || a[1].nearestM - b[1].nearestM)
    .slice(0, MAX_SUGGESTIONS)
    .map(([category, { count, nearestM }]) => ({
      category,
      query: `${category.toLowerCase()} cerca de mí`,
      label: `${category} cerca de ti`,
      detail: originIsUserPosition
        ? `${count} ${count === 1 ? "lugar" : "lugares"} · el más cercano a ${formatDistanceM(nearestM)}`
        : `${count} ${count === 1 ? "lugar" : "lugares"} en ${cityLabel}`,
    }));
}
