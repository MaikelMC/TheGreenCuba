"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef, useState } from "react";
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
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  PREFER_CANVAS,
  DETECT_RETINA,
} from "@/lib/map/map-config";
import { validatePlaceCoordinates } from "@/lib/map/coordinates";
import { readUserPreferences, locationCenter } from "@/lib/user-preferences-store";
import { createPlacePinIcon } from "./pin-icon";
import type { LocationPoint } from "./MapLocationPicker";

const tile = TILE_CONFIGS[DEFAULT_TILE] ?? TILE_CONFIGS.voyager!;

const SEA_ERROR =
  "Ese punto está en el mar o fuera de Cuba. Mueve el pin a un punto en tierra.";

function FlyController({
  target,
  zoom,
}: {
  target: LocationPoint | null;
  zoom: number;
}) {
  const map = useMap();
  const last = useRef("");
  useEffect(() => {
    if (!target) return;
    const key = `${target.lat.toFixed(6)},${target.lng.toFixed(6)}@${zoom}`;
    if (key === last.current) return;
    last.current = key;
    map.flyTo([target.lat, target.lng], zoom, { duration: 0.8 });
  }, [target, zoom, map]);
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
  flyZoom = 13,
}: {
  value: LocationPoint | null;
  onPointChange: (point: LocationPoint | null) => void;
  flyTarget: LocationPoint | null;
  flyZoom?: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  // Abre centrado en la ubicación guardada del usuario (default Santiago) o en
  // el negocio que se está editando. Ya no arranca desde La Habana.
  const [center] = useState<[number, number]>(() =>
    value
      ? [value.lat, value.lng]
      : locationCenter(readUserPreferences().location),
  );
  const [initialZoom] = useState(() => (value ? 16 : DEFAULT_ZOOM));

  const pinIcon = createPlacePinIcon("selected");

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
    return <div className="h-full w-full bg-sand-deep" />;
  }

  return (
    <div className="absolute inset-0">
      <MapContainer
        center={center}
        zoom={initialZoom}
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
        <FlyController target={flyTarget} zoom={flyZoom} />
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
