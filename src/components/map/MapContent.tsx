"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { MapMarkers } from "./MapMarkers";
import { UserLocationMarker } from "./UserLocationMarker";
import { LocateButton } from "./LocateButton";
import { RouteLayer } from "./RouteLayer";
import {
  TILE_CONFIGS,
  DEFAULT_TILE,
  HAVANA_CENTER,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  GEO_ZOOM,
  PREFER_CANVAS,
  DETECT_RETINA,
} from "@/lib/map/map-config";
import { filterValidPlaces } from "@/lib/map/coordinates";
import type { MapPlace, MapViewProps } from "./types";

function MapEventsHandler({
  onMapMove,
}: {
  onMapMove?: MapViewProps["onMapMove"];
}) {
  useMapEvents({
    moveend: (e) => {
      if (!onMapMove) return;
      const map = e.target;
      const bounds = map.getBounds();
      const center = map.getCenter();
      onMapMove(
        {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        },
        [center.lat, center.lng],
        map.getZoom(),
      );
    },
  });
  return null;
}

function FitBoundsOnMount({
  places,
  hasUserLocation,
  disabled,
}: {
  places: MapPlace[];
  hasUserLocation: boolean;
  disabled?: boolean;
}) {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (hasFit.current || places.length === 0 || hasUserLocation || disabled) return;
    hasFit.current = true;

    const p = places;
    if (p.length === 1) {
      map.setView([p[0]!.lat, p[0]!.lng], 15);
    } else {
      const bounds = L.latLngBounds(p.map((x) => [x.lat, x.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [places, map, hasUserLocation, disabled]);

  return null;
}

function MapChildren({
  tile,
  places,
  selectedPlaceId,
  onPlaceSelect,
  onPlaceRoute,
  userLocation,
  onUserLocated,
  onLocateStateChange,
  focusTarget,
  viewTarget,
}: {
  tile: ReturnType<typeof getTile>;
  places: MapPlace[];
  selectedPlaceId?: string | null;
  onPlaceSelect?: MapViewProps["onPlaceSelect"];
  onPlaceRoute?: MapViewProps["onPlaceRoute"];
  userLocation?: MapViewProps["userLocation"];
  onUserLocated?: MapViewProps["onUserLocated"];
  onLocateStateChange?: MapViewProps["onLocateStateChange"];
  focusTarget?: MapViewProps["focusTarget"];
  viewTarget?: MapViewProps["viewTarget"];
}) {
  const [ready, setReady] = useState(false);
  const map = useMap();
  const lastFlownTo = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(timer);
  }, [map]);

  // Fly to the user location when it arrives (or changes to new coordinates).
  // `ready` is a dep so a location that resolved before the map was ready still
  // lands at the right spot once the map is available.
  useEffect(() => {
    if (!userLocation) return;
    if (
      lastFlownTo.current &&
      lastFlownTo.current.lat === userLocation.lat &&
      lastFlownTo.current.lng === userLocation.lng
    ) {
      return;
    }
    lastFlownTo.current = userLocation;
    map.flyTo([userLocation.lat, userLocation.lng], GEO_ZOOM, { duration: 0.8 });
  }, [userLocation, map, ready]);

  // Fly to a specific place when a card's location button is tapped.
  const lastFocusKey = useRef<number | null>(null);
  useEffect(() => {
    if (!focusTarget) return;
    if (lastFocusKey.current === focusTarget.key) return;
    lastFocusKey.current = focusTarget.key;
    map.flyTo([focusTarget.lat, focusTarget.lng], 16, { duration: 0.8 });
  }, [focusTarget, map]);

  // Volar a coordenadas genéricas (ej: dirección elegida en el geocodificador).
  const lastViewKey = useRef<number | null>(null);
  useEffect(() => {
    if (!viewTarget) return;
    if (lastViewKey.current === viewTarget.key) return;
    lastViewKey.current = viewTarget.key;
    map.flyTo([viewTarget.lat, viewTarget.lng], viewTarget.zoom ?? 17, {
      duration: 0.8,
    });
  }, [viewTarget, map]);

  // Don't render markers/layers until the map is actually ready.
  if (!ready) return null;

  return (
    <>
      <TileLayer
        url={tile.url}
        attribution={tile.attribution}
        maxZoom={tile.maxZoom}
        detectRetina={DETECT_RETINA}
      />
      <MapMarkers
        places={places}
        selectedId={selectedPlaceId}
        onSelect={onPlaceSelect}
        onRoute={onPlaceRoute}
      />
      {userLocation && (
        <UserLocationMarker
          lat={userLocation.lat}
          lng={userLocation.lng}
          accuracy={userLocation.accuracy}
        />
      )}
      <LocateButton
        onUserLocated={onUserLocated}
        onLocateStateChange={onLocateStateChange}
      />
    </>
  );
}

function getTile(tileKey: string) {
  return TILE_CONFIGS[tileKey] ?? TILE_CONFIGS[DEFAULT_TILE]!;
}

export function MapContent({
  places,
  selectedPlaceId,
  onPlaceSelect,
  onPlaceRoute,
  onMapMove,
  userLocation,
  onUserLocated,
  onLocateStateChange,
  focusTarget,
  viewTarget,
  route,
  routeOrigin,
  initialCenter = HAVANA_CENTER,
  initialZoom = DEFAULT_ZOOM,
  maxZoom = MAX_ZOOM,
  tileKey = DEFAULT_TILE,
  disableAutoFit,
}: MapViewProps) {
  const [mounted, setMounted] = useState(false);
  const validPlaces = useMemo(() => filterValidPlaces(places), [places]);
  const hasUserLocation = Boolean(userLocation);
  const effectiveInitialCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : initialCenter ?? HAVANA_CENTER;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="h-full w-full bg-sand-deep"
        style={{ minHeight: "inherit" }}
      />
    );
  }

  return (
    <MapContainer
      center={effectiveInitialCenter}
      zoom={initialZoom}
      minZoom={MIN_ZOOM}
      maxZoom={maxZoom}
      zoomControl={false}
      preferCanvas={PREFER_CANVAS}
      className="z-0"
      style={{ height: "100%", width: "100%" }}
    >
      <ZoomControl position="bottomleft" />
      <MapEventsHandler onMapMove={onMapMove} />
      <FitBoundsOnMount
        places={validPlaces}
        hasUserLocation={hasUserLocation || Boolean(route)}
        disabled={disableAutoFit}
      />

      <MapChildren
        tile={getTile(tileKey)}
        places={validPlaces}
        selectedPlaceId={selectedPlaceId}
        onPlaceSelect={onPlaceSelect}
        onPlaceRoute={onPlaceRoute}
        userLocation={userLocation}
        onUserLocated={onUserLocated}
        onLocateStateChange={onLocateStateChange}
        focusTarget={focusTarget}
        viewTarget={viewTarget}
      />

      {route && routeOrigin && route.coordinates.length > 0 && (
        <RouteLayer
          route={route}
          origin={routeOrigin}
          dest={{
            lat: route.coordinates[route.coordinates.length - 1]![0],
            lng: route.coordinates[route.coordinates.length - 1]![1],
          }}
        />
      )}
    </MapContainer>
  );
}
