"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  ZoomControl,
  useMap
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Place } from "@/lib/places";
import { CATEGORY_META } from "@/lib/places";

// Bounding box de Cuba para el encuadre inicial
const CUBA_BOUNDS: L.LatLngBoundsExpression = [
  [19.8, -85.0],
  [23.3, -74.0]
];

// Pin premium personalizado
function makePin(selected: boolean) {
  const el = document.createElement("div");
  el.style.cssText = `position:relative;width:0;height:0;`;
  const inner = document.createElement("div");
  inner.style.cssText = `
    position:absolute;left:-16px;top:-42px;
    width:32px;height:32px;border-radius:9999px 9999px 9999px 4px;
    transform:rotate(-45deg);
    background:linear-gradient(135deg, #35AF6D, #0F7A41);
    border:2.5px solid #ffffff;
    box-shadow:0 8px 18px rgba(8,19,13,0.35);
    display:grid;place-items:center;
    ${selected ? "outline:4px solid rgba(53,175,109,0.25);" : ""}
  `;
  const dot = document.createElement("div");
  dot.style.cssText =
    "width:10px;height:10px;border-radius:9999px;background:#fff;transform:rotate(45deg);";
  inner.appendChild(dot);
  el.appendChild(inner);
  return L.divIcon({ html: el.outerHTML, iconSize: [0, 0], iconAnchor: [16, 42], className: "" });
}

// Componente que reacciona a la selección: vuela al lugar
function FlyToSelection({
  places,
  selectedId
}: {
  places: Place[];
  selectedId: string | null;
}) {
  const map = useMap();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (selectedId && selectedId !== prev.current) {
      const place = places.find((p) => p.id === selectedId);
      if (place) {
        map.flyTo([place.lat, place.lng], 14, { duration: 1.4, easeLinearity: 0.2 });
      }
    }
    prev.current = selectedId;
  }, [selectedId, places, map]);
  return null;
}

// La rueda del ratón sobre el mapa no debe secuestrar el scroll de la página.
// El zoom con rueda se desactiva por defecto y solo se activa al hacer clic o
// dar foco al mapa. Además se reduce su sensibilidad para que no "brinque".
function ScrollZoomOnFocus() {
  const map = useMap();

  useEffect(() => {
    const wheel = map.scrollWheelZoom as L.Handler & {
      options: { wheelPxPerZoomLevel: number; wheelDebounceTime: number };
    };
    if (wheel?.options) {
      wheel.options.wheelPxPerZoomLevel = 170;
      wheel.options.wheelDebounceTime = 90;
    }
    map.scrollWheelZoom.disable();

    const enable = () => map.scrollWheelZoom.enable();
    const onBlur = () => map.scrollWheelZoom.disable();
    map.on("focus", enable);
    map.on("click", enable);
    map.on("blur", onBlur);
    return () => {
      map.off("focus", enable);
      map.off("click", enable);
      map.off("blur", onBlur);
      map.scrollWheelZoom.disable();
    };
  }, [map]);

  return null;
}

// Encuadra Cuba + ajusta al tocar mapa (una vez)
function InitialFit() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.fitBounds(CUBA_BOUNDS, { padding: [24, 24] });
  }, [map]);
  return null;
}

interface LeafMapProps {
  places: Place[];
  selectedId: string | null;
  onSelect: (p: Place) => void;
}

export default function LeafMap({ places, selectedId, onSelect }: LeafMapProps) {
  const icons = useMemo(
    () => places.map((p) => makePin(p.id === selectedId)),
    [places, selectedId]
  );

  const iconsById = useMemo(() => {
    const m: Record<string, L.DivIcon> = {};
    places.forEach((p, i) => (m[p.id] = icons[i]));
    return m;
  }, [places, icons]);

  return (
    <MapContainer
      center={[22.0, -79.5]}
      zoom={7}
      zoomControl={false}
      preferCanvas
      scrollWheelZoom={false}
      className="z-0 h-full w-full"
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; La Verde'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <InitialFit />
      <FlyToSelection places={places} selectedId={selectedId} />
      <ScrollZoomOnFocus />
      <ZoomControl position="bottomright" />
      {places.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={iconsById[p.id]}
          eventHandlers={{
            click: () => onSelect(p)
          }}
        >
          <Popup closeButton={false} minWidth={220}>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-verde-300">
                {CATEGORY_META[p.category].emoji} {CATEGORY_META[p.category].label} ·{" "}
                {p.priceLabel}
              </div>
              <div className="mt-1 font-display text-base font-bold text-white">
                {p.name}
              </div>
              <div className="text-xs text-white/60">
                {p.city}, {p.province}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(p);
                }}
                className="mt-2 w-full rounded-full bg-verde-400 py-1.5 text-xs font-bold text-verde-950"
              >
                Ver detalles
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}