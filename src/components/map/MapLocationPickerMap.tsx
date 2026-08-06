"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import {
  TILE_CONFIGS,
  DEFAULT_TILE,
  HAVANA_CENTER,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  PREFER_CANVAS,
  DETECT_RETINA,
} from "@/lib/map/map-config";
import { validatePlaceCoordinates } from "@/lib/map/coordinates";
import type { LocationPoint } from "./MapLocationPicker";

const tile = TILE_CONFIGS[DEFAULT_TILE] ?? TILE_CONFIGS.voyager!;

const SEA_ERROR =
  "Ese punto está en el mar o fuera de Cuba. Mueve el pin a un punto en tierra.";

function FlyController({ target }: { target: LocationPoint | null }) {
  const map = useMap();
  const last = useRef("");
  useEffect(() => {
    if (!target) return;
    const key = `${target.lat.toFixed(6)},${target.lng.toFixed(6)}`;
    if (key === last.current) return;
    last.current = key;
    map.flyTo([target.lat, target.lng], 13, { duration: 0.8 });
  }, [target, map]);
  return null;
}

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

export function MapLocationPickerMap({
  value,
  onPointChange,
  flyTarget,
}: {
  value: LocationPoint | null;
  onPointChange: (point: LocationPoint | null) => void;
  flyTarget: LocationPoint | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const pinIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        iconSize: [34, 42],
        iconAnchor: [17, 40],
        html: `<svg width="34" height="42" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" fill="oklch(62% 0.16 145)" stroke="white" stroke-width="1.5"/><circle cx="12" cy="10" r="3" fill="white"/></svg>`,
      }),
    [],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePick = useCallback(
    (lat: number, lng: number) => {
      const validation = validatePlaceCoordinates(lat, lng);
      if (validation.valid) {
        setError(null);
        onPointChange({ lat, lng });
      } else {
        setError(SEA_ERROR);
      }
    },
    [onPointChange],
  );

  if (!mounted) {
    return <div className="h-full w-full bg-[oklch(92%_0.008_85)]" />;
  }

  return (
    <div className="absolute inset-0">
      <MapContainer
        center={HAVANA_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        zoomControl={false}
        preferCanvas={PREFER_CANVAS}
        className="z-0 h-full w-full"
        style={{ height: "100%", width: "100%" }}
      >
        <ZoomControl position="bottomleft" />
        <TileLayer
          url={tile.url}
          attribution={tile.attribution}
          maxZoom={tile.maxZoom}
          detectRetina={DETECT_RETINA}
        />
        <ClickCatcher onPick={handlePick} />
        <FlyController target={flyTarget} />
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const latlng = (e.target as L.Marker).getLatLng();
                handlePick(latlng.lat, latlng.lng);
              },
            }}
          />
        )}
      </MapContainer>

      {error && (
        <div className="absolute bottom-gap-sm inset-x-gap-sm z-[500] pointer-events-none">
          <div className="px-3 py-[7px] rounded-lv-lg bg-destructive/10 border border-destructive/25 text-[12px] text-destructive font-medium">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
