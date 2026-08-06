import type { ReactNode } from "react";

export interface MapPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
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
  initialCenter?: [number, number];
  initialZoom?: number;
  maxZoom?: number;
  tileKey?: string;
  searching?: boolean;
  children?: ReactNode;
  className?: string;
}

export type GeolocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; lat: number; lng: number }
  | { status: "error"; message: string };
