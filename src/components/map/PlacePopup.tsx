"use client";

import { Navigation } from "lucide-react";
import { type MapPlace } from "./types";

interface PlacePopupProps {
  place: MapPlace;
  onRoute?: (place: MapPlace) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Cafetería: "bg-lv-amber/12 text-lv-amber",
  Restaurante: "bg-accent/10 text-accent",
  "Vida nocturna": "bg-destructive/10 text-destructive",
  Mercado: "bg-lv-teal/10 text-lv-teal",
};

export function PlacePopup({ place, onRoute }: PlacePopupProps) {
  return (
    <div className="place-popup">
      <div className="place-popup-header">
        <strong>{place.name}</strong>
        <span
          className={`place-popup-category ${
            CATEGORY_COLORS[place.category] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {place.category}
        </span>
      </div>
      {place.barrio && <div className="place-popup-barrio">{place.barrio}</div>}
      <div className="place-popup-footer">
        {place.distance && <span>{place.distance}</span>}
        {place.price && <span>{place.price}</span>}
        {place.rating && <span>★ {place.rating}</span>}
      </div>
      {onRoute && (
        <button
          type="button"
          onClick={() => onRoute(place)}
          className="place-popup-route"
        >
          <Navigation size={13} strokeWidth={2} />
          Ruta guiada
        </button>
      )}
      <a
        href={`/place/${place.id}`}
        className="place-popup-link"
        data-place-id={place.id}
      >
        Ver más →
      </a>
    </div>
  );
}

export function getPlacePopupOptions() {
  return {
    className: "custom-leaflet-popup",
    closeButton: true,
    maxWidth: 280,
    minWidth: 220,
  };
}
