"use client";

import { memo, useCallback } from "react";
import { Marker, Popup } from "react-leaflet";
import { PlacePopup, getPlacePopupOptions } from "./PlacePopup";
import { createPlacePinIcon, type PlacePinVariant } from "./pin-icon";
import { placeIcon } from "@/lib/places";
import { tieneRespaldo } from "@/lib/energia";
import { hayOferta } from "@/lib/ofertas";
import type { MapPlace } from "./types";

interface MapMarkersProps {
  places: MapPlace[];
  selectedId?: string | null;
  onSelect?: (place: MapPlace) => void;
  onRoute?: (place: MapPlace) => void;
  routePlaceId: string | null;
  onRouteClear: () => void;
}

function markerVariant(isSelected: boolean, isBoosted: boolean, isProject: boolean): PlacePinVariant {
  if (isProject) return "project";
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
  routeFixed,
  onRouteClear,
}: {
  place: MapPlace;
  isSelected: boolean;
  isBoosted: boolean;
  onSelect?: (place: MapPlace) => void;
  onRoute?: (place: MapPlace) => void;
  routeFixed: boolean;
  onRouteClear: () => void;
}) {
  /* Sin foto: el pin lleva el icono de la categoría. La foto del negocio sigue
     en el popup, en la ficha y en las tarjetas de recomendaciones; en el pin
     no, porque a ese tamaño el logo es una mancha y deja de distinguir un
     restaurante de una playa, que es lo que el pin existe para hacer. */
  const icon = createPlacePinIcon(
    markerVariant(isSelected, isBoosted, place.isProject ?? false),
    placeIcon(place.icon, place.category),
    /* El rayo del pin. Un proyecto no lo lleva: su energía no es un dato que
       tenga sentido, y el pin de proyecto ya se distingue por su color. */
    !place.isProject && tieneRespaldo(place.energiaRespaldo),
    /* Y el `%` de la oferta, al otro hombro. Mismo criterio: una oferta flash
       rebaja un precio de la carta, y un proyecto no tiene precios que rebajar. */
    !place.isProject && hayOferta(place.ofertas),
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
        <PlacePopup
          place={place}
          onRoute={onRoute}
          routeFixed={routeFixed}
          onRouteClear={onRouteClear}
        />
      </Popup>
    </Marker>
  );
});

export const MapMarkers = memo(function MapMarkers({
  places,
  selectedId,
  onSelect,
  onRoute,
  routePlaceId,
  onRouteClear,
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
          routeFixed={place.id === routePlaceId}
          onRouteClear={onRouteClear}
        />
      ))}
    </>
  );
});
