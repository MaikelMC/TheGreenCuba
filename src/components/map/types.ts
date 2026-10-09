import type { ReactNode } from "react";
import type { RouteResult, RoutePoint } from "@/lib/map/routing";
import type { ProjectOfferPackage } from "@/lib/db/schema/project_requests";
import type { EnergiaRespaldo } from "@/lib/energia";
import type { UserPlaceOferta } from "@/lib/places-store";

export interface MapPlace {
  id: string;
  name: string;
  isProject?: boolean;
  lat: number;
  lng: number;
  category: string;
  /** Nombre del icono Lucide del pin. Sin él, el de la categoría. */
  icon?: string;
  barrio?: string;
  rating?: number;
  distance?: string;
  price?: string;
  /** Fechas ya legibles de un proyecto («12 ago – 20 ago»). Los negocios no
      tienen: su horario vive en `schedule` de `UserPlace` y no viaja al pin. */
  schedule?: string;
  /** Foto del pin. El logo del negocio manda: en un disco de 15 px se reconoce
      antes una marca que una foto de fachada. */
  image?: string;
  /**
   * Foto del popup, que no es la misma que la del pin.
   *
   * El popup enseña una tarjeta ancha, y ahí lo que vende es la portada del
   * negocio; el logo cae bien en el pin pero recortado en 84 px de alto se lee
   * como un cuadro suelto. Cae al logo cuando no hay ninguna foto subida.
   */
  coverImage?: string;
  offerPackages?: ProjectOfferPackage[];
  tags?: { label: string; variant?: string }[];
  /** Energía de respaldo del negocio. `null`/ausente = el dueño no lo dijo. */
  energiaRespaldo?: EnergiaRespaldo | null;
  /**
   * Las ofertas flash del negocio, **todas** —también las caducadas—.
   *
   * El pin solo pregunta si hay alguna viva (`hayOferta`), y lo pregunta con el
   * «ahora» del render: el catálogo del cliente se refresca sin recargar la
   * página, así que un pin puede perder su `%` solo, sin volver a pedir nada.
   */
  ofertas?: UserPlaceOferta[];
  /** Nota corta sobre los apagones, para el `title` de la etiqueta. */
  notaApagon?: string;
}

export type LocateState = "idle" | "loading" | "success" | "denied" | "error";

export interface MapViewProps {
  places: MapPlace[];
  selectedPlaceId?: string | null;
  onPlaceSelect?: (place: MapPlace) => void;
  onPlaceRoute?: (place: MapPlace) => void;
  /** Click en el mapa vacío —fuera de un pin—. Se usa para quitar la selección. */
  onMapClick?: () => void;
  onMapMove?: (
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    },
    center: [number, number],
    zoom: number,
  ) => void;
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
  onUserLocated?: (lat: number, lng: number, accuracy?: number) => void;
  onLocateStateChange?: (state: LocateState) => void;
  /** Cuando cambia, el mapa vuela hasta esas coordenadas (útil desde las cards). */
  focusTarget?: { lat: number; lng: number; key: number } | null;
  /** Vuelo genérico del mapa (ej: elegir dirección en el buscador geocodificador). */
  viewTarget?: { lat: number; lng: number; zoom?: number; key: number } | null;
  /** Ruta activa a dibujar entre la ubicación del usuario y un lugar. */
  route?: RouteResult | null;
  routeOrigin?: RoutePoint | null;
  /* Estos dos van sin `?` a propósito. Son opcionales en el destino —el popup
     solo los usa si el lugar es el destino de la ruta—, y con `?` en toda la
     cadena una parada que se olvide de pasarlos no da error: el popup se queda
     sin la función y el botón deja de quitar la ruta, en silencio. Así el
     compilador obliga a que lleguen. Fue justo el fallo que tuvo. */

  /** Lugar que es destino de la ruta activa: su popup muestra la ruta fijada. */
  routePlaceId: string | null;
  /** Quita la ruta del mapa, desde el popup del destino. */
  onRouteClear: () => void;
  initialCenter?: [number, number];
  initialZoom?: number;
  maxZoom?: number;
  tileKey?: string;
  /** Evita el auto-fit de bounds al montar (útil cuando se centra en una zona elegida). */
  disableAutoFit?: boolean;
  children?: ReactNode;
  className?: string;
}

export type GeolocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; lat: number; lng: number }
  | { status: "error"; message: string };
