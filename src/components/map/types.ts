import type { ReactNode } from "react";
import type { RouteResult, RoutePoint } from "@/lib/map/routing";

export interface MapPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  /** Nombre del icono Lucide del pin. Sin él, el de la categoría. */
  icon?: string;
  barrio?: string;
  rating?: number;
  distance?: string;
  price?: string;
  image?: string;
  tags?: { label: string; variant?: string }[];
}

export type LocateState = "idle" | "loading" | "success" | "denied" | "error";

export interface MapViewProps {
  places: MapPlace[];
  selectedPlaceId?: string | null;
  onPlaceSelect?: (place: MapPlace) => void;
  onPlaceRoute?: (place: MapPlace) => void;
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
  initialCenter?: [number, number];
  initialZoom?: number;
  maxZoom?: number;
  tileKey?: string;
  /** Evita el auto-fit de bounds al montar (útil cuando se centra en una zona elegida). */
  disableAutoFit?: boolean;
  searching?: boolean;
  children?: ReactNode;
  className?: string;
}

export type GeolocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; lat: number; lng: number }
  | { status: "error"; message: string };
