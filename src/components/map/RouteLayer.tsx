"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { Polyline, Marker, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import { createPlacePinIcon } from "./pin-icon";
import type { RouteResult, RoutePoint } from "@/lib/map/routing";

interface RouteLayerProps {
  route: RouteResult | null;
  origin: RoutePoint;
  dest: RoutePoint;
}

/* Origen de la ruta = donde está el usuario, así que va en `ink` igual que el
   punto "estás aquí" (UserLocationMarker), no en el verde de los lugares. */
function createOriginDot() {
  return divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="width:14px;height:14px;background:#08130D;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(8,19,13,0.4)"></div>`,
  });
}

export const RouteLayer = memo(function RouteLayer({
  route,
  origin,
  dest,
}: RouteLayerProps) {
  const map = useMap();
  const originIcon = useMemo(() => createOriginDot(), []);
  const destIcon = createPlacePinIcon("default");
  const lastRoute = useRef<RouteResult | null>(null);

  useEffect(() => {
    if (!route || route === lastRoute.current) return;
    lastRoute.current = route;
    const latLngs = route.coordinates.map(
      ([lat, lng]) => [lat, lng] as [number, number],
    );
    map.fitBounds(latLngs, { padding: [60, 60], maxZoom: 16 });
  }, [route, map]);

  if (!route || route.coordinates.length === 0) return null;

  return (
    <>
      <Polyline
        positions={route.coordinates}
        pathOptions={{
          color: "#35AF6D", /* verde-400, el mismo del pin de destino */
          weight: 5,
          opacity: 0.85,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      <Marker position={[origin.lat, origin.lng]} icon={originIcon} />
      <Marker position={[dest.lat, dest.lng]} icon={destIcon} />
    </>
  );
});
