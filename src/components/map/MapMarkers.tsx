"use client";

import { memo, useCallback } from "react";
import { Marker, Popup } from "react-leaflet";
import { PlacePopup, getPlacePopupOptions } from "./PlacePopup";
import { createPlacePinIcon, type PlacePinVariant } from "./pin-icon";
import { placeIcon } from "@/lib/places";
import type { MapPlace } from "./types";

interface MapMarkersProps {
  places: MapPlace[];
  selectedId?: string | null;
  onSelect?: (place: MapPlace) => void;
  onRoute?: (place: MapPlace) => void;
}

function markerVariant(isSelected: boolean, isBoosted: boolean): PlacePinVariant {
  if (isSelected) return "selected";
  if (isBoosted) return "boosted";
  return "default";
}

const MarkerItem = memo(function MarkerItem({
  place,
  isSelected,
  isBoosted,
  onSelect,
  onRoute,
}: {
  place: MapPlace;
  isSelected: boolean;
  isBoosted: boolean;
  onSelect?: (place: MapPlace) => void;
  onRoute?: (place: MapPlace) => void;
}) {
  const icon = createPlacePinIcon(
    markerVariant(isSelected, isBoosted),
    placeIcon(place.icon, place.category),
  );

  const handleClick = useCallback(() => {
    onSelect?.(place);
  }, [onSelect, place]);

  return (
    <Marker
      position={[place.lat, place.lng]}
      icon={icon}
      eventHandlers={{ click: handleClick }}
    >
      <Popup {...getPlacePopupOptions()}>
        <PlacePopup place={place} onRoute={onRoute} />
      </Popup>
    </Marker>
  );
});

export const MapMarkers = memo(function MapMarkers({
  places,
  selectedId,
  onSelect,
  onRoute,
}: MapMarkersProps) {
  return (
    <>
      {places.map((place) => (
        <MarkerItem
          key={place.id}
          place={place}
          isSelected={place.id === selectedId}
          isBoosted={place.tags?.some((t) => t.label === "Destacado") ?? false}
          onSelect={onSelect}
          onRoute={onRoute}
        />
      ))}
    </>
  );
});
