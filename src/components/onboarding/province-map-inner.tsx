"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { TILE_CONFIGS, DEFAULT_TILE, MIN_ZOOM, MAX_ZOOM } from "@/lib/map/map-config";
import { locationCenter } from "@/lib/user-preferences-store";
import { createPlacePinIcon } from "@/components/map/pin-icon";

const PIN_ICON = createPlacePinIcon("selected");

function FlyTo({ location }: { location: string }) {
  const map = useMap();
  const prev = useRef(location);

  useEffect(() => {
    if (prev.current === location) return;
    prev.current = location;
    map.flyTo(locationCenter(location), 11, { duration: 0.7 });
  }, [location, map]);

  return null;
}

export function ProvinceMapInner({ location }: { location: string }) {
  const center = locationCenter(location);
  const tile = TILE_CONFIGS[DEFAULT_TILE] ?? TILE_CONFIGS.voyager!;

  return (
    <MapContainer
      center={center}
      zoom={11}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      zoomControl={false}
      className="z-0"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />
      <FlyTo location={location} />
      <Marker position={center} icon={PIN_ICON} interactive={false} />
    </MapContainer>
  );
}