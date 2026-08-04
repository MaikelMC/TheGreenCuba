"use client";

import { memo, useCallback, useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import { divIcon } from "leaflet";
import { PlacePopup, getPlacePopupOptions } from "./PlacePopup";
import type { MapPlace } from "./types";

interface MapMarkersProps {
  places: MapPlace[];
  selectedId?: string | null;
  onSelect?: (place: MapPlace) => void;
}

function createMarkerIcon(isSelected: boolean, isBoosted: boolean) {
  const size = isSelected ? 44 : isBoosted ? 36 : 28;
  const bg = isBoosted ? "#c4841d" : "oklch(62% 0.16 145)";
  const shadow = isSelected
    ? "0 0 0 3px oklch(62% 0.16 145 / 0.2)"
    : isBoosted
      ? "0 2px 8px rgb(196 132 29 / 0.35)"
      : "0 2px 6px oklch(62% 0.16 145 / 0.25)";

  return divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;background:${bg};border:${isSelected ? "3px" : "2px"} solid white;border-radius:50%;display:grid;place-items:center;box-shadow:${shadow};transition:all 200ms ease;cursor:pointer;${isBoosted ? "animation:pulse-ring 2s ease-in-out infinite" : ""}"><svg width="${size * 0.45}" height="${size * 0.45}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  });
}

const MarkerItem = memo(function MarkerItem({
  place,
  isSelected,
  isBoosted,
  onSelect,
}: {
  place: MapPlace;
  isSelected: boolean;
  isBoosted: boolean;
  onSelect?: (place: MapPlace) => void;
}) {
  const icon = useMemo(
    () => createMarkerIcon(isSelected, isBoosted),
    [isSelected, isBoosted],
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
        <PlacePopup place={place} />
      </Popup>
    </Marker>
  );
});

export const MapMarkers = memo(function MapMarkers({
  places,
  selectedId,
  onSelect,
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
        />
      ))}
    </>
  );
});
