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

function FitBoundsOnMount({ places }: { places: MapPlace[] }) {
  const map = useMap();
  const hasFit = useRef(false);

  useEffect(() => {
    if (hasFit.current || places.length === 0) return;
    hasFit.current = true;

    const p = places;
    if (p.length === 1) {
      map.setView([p[0]!.lat, p[0]!.lng], 15);
    } else {
      const bounds = L.latLngBounds(p.map((x) => [x.lat, x.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [places, map]);

  return null;
}

function MapChildren({
  tile,
  places,
  selectedPlaceId,
  onPlaceSelect,
  userLocation,
  onUserLocated,
  onLocateStateChange,
}: {
  tile: ReturnType<typeof getTile>;
  places: MapPlace[];
  selectedPlaceId?: string | null;
  onPlaceSelect?: MapViewProps["onPlaceSelect"];
  userLocation?: MapViewProps["userLocation"];
  onUserLocated?: MapViewProps["onUserLocated"];
  onLocateStateChange?: MapViewProps["onLocateStateChange"];
}) {
  const [ready, setReady] = useState(false);
  const map = useMap();
  const lastFlownTo = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(timer);
  }, [map]);

  // Fly to the user location only when it changes to new coordinates.
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
  }, [userLocation, map]);

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
  onMapMove,
  userLocation,
  onUserLocated,
  onLocateStateChange,
  initialCenter = HAVANA_CENTER,
  initialZoom = DEFAULT_ZOOM,
  maxZoom = MAX_ZOOM,
  tileKey = DEFAULT_TILE,
}: MapViewProps) {
  const [mounted, setMounted] = useState(false);
  const validPlaces = useMemo(() => filterValidPlaces(places), [places]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="h-full w-full bg-[oklch(92%_0.008_85)]"
        style={{ minHeight: "inherit" }}
      />
    );
  }

  return (
    <MapContainer
      center={initialCenter}
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
      <FitBoundsOnMount places={validPlaces} />

      <MapChildren
        tile={getTile(tileKey)}
        places={validPlaces}
        selectedPlaceId={selectedPlaceId}
        onPlaceSelect={onPlaceSelect}
        userLocation={userLocation}
        onUserLocated={onUserLocated}
        onLocateStateChange={onLocateStateChange}
      />
    </MapContainer>
  );
}
