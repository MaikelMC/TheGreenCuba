"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { TILE_CONFIGS, DEFAULT_TILE, MIN_ZOOM, MAX_ZOOM } from "@/lib/map/map-config";
import { locationCenter } from "@/lib/user-preferences-store";

const PIN_ICON = L.divIcon({
  className: "onboarding-pin",
  html: `
    <svg viewBox="0 0 24 24" width="30" height="30" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.25))">
      <path d="M12 2C7.6 2 4 5.6 4 10c0 5.25 8 12 8 12s8-6.75 8-12c0-4.4-3.6-8-8-8z" fill="oklch(62% 0.16 145)"/>
      <circle cx="12" cy="10" r="3.2" fill="#ffffff"/>
    </svg>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

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