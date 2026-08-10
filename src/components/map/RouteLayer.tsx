"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { Polyline, Marker, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import type { RouteResult, RoutePoint } from "@/lib/map/routing";

interface RouteLayerProps {
  route: RouteResult | null;
  origin: RoutePoint;
  dest: RoutePoint;
}

function createOriginDot() {
  return divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="width:14px;height:14px;background:oklch(62% 0.14 145);border:3px solid white;border-radius:50%;box-shadow:0 2px 8px oklch(62% 0.14 145 / 0.4)"></div>`,
  });
}

function createDestPin() {
  return divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 27],
    html: `<div style="width:30px;height:30px;background:oklch(62% 0.16 145);border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px oklch(62% 0.16 145 / 0.4);display:grid;place-items:center"><div style="width:9px;height:9px;background:white;border-radius:50%;transform:rotate(45deg)"></div></div>`,
  });
}

export const RouteLayer = memo(function RouteLayer({
  route,
  origin,
  dest,
}: RouteLayerProps) {
  const map = useMap();
  const originIcon = useMemo(() => createOriginDot(), []);
  const destIcon = useMemo(() => createDestPin(), []);
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
          color: "oklch(62% 0.16 145)",
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
