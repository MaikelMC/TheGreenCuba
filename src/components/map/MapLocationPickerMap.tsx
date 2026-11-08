"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import {
  CUBA_BOUNDS,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  LIBERTY_STYLE_URL,
  MAP_ATTRIBUTION,
} from "@/lib/map/map-config";
import { aplicarColoresLaVerde, aplicarTemaMapa } from "@/lib/map/tema-mapa";
import { buildPinSvg, parsePinImageId, PIN_STYLES } from "./pin-icon";
import { validatePlaceCoordinates } from "@/lib/map/coordinates";
import { readUserPreferences, locationCenter } from "@/lib/user-preferences-store";
import { fetchMe } from "@/lib/session-client";
import { useTheme } from "next-themes";
import type { LocationPoint } from "./MapLocationPicker";

const SEA_ERROR =
  "Ese punto está en el mar o fuera de Cuba. Mueve el pin a un punto en tierra.";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const { resolvedTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

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

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ── Inicializar mapa ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    let cancelled = false;

    async function init() {
      if (cancelled || !containerRef.current) return;

      /* Centro inicial: valor actual, ubicación del usuario, o La Habana */
      let center: [number, number] = [-82.359, 23.1374];
      if (value) {
        center = [value.lng, value.lat];
      } else {
        try {
          const data = await fetchMe<{ authenticated: boolean; user: { id?: string } | null }>();
          if (data.authenticated && data.user?.id) {
            const prefs = readUserPreferences(data.user.id);
            const [lat, lng] = locationCenter(prefs.location);
            center = [lng, lat];
          }
        } catch { /* sin sesión: La Habana */ }
      }

      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: LIBERTY_STYLE_URL,
        center,
        zoom: value ? 16 : DEFAULT_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        maxBounds: CUBA_BOUNDS,
        fadeDuration: 100,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.AttributionControl({ compact: true, customAttribution: MAP_ATTRIBUTION }),
        "bottom-right",
      );
      map.addControl(new maplibregl.NavigationControl(), "bottom-left");

      /* Registrar pin del marcador al vuelo */
      map.on("styleimagemissing", (e) => {
        if (mapaRef.current?.hasImage(e.id)) return;
        const parsed = parsePinImageId(e.id);
        if (!parsed) return;
        const { svg, width, height } = buildPinSvg(parsed.variant, parsed.iconKey, parsed.conEnergia, parsed.conOferta);
        const img = new Image(width, height);
        img.onload = () => { if (!map.hasImage(e.id)) map.addImage(e.id, img, { pixelRatio: 2 }); };
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      });

      map.on("load", () => {
        if (cancelled) { map.remove(); return; }

        aplicarColoresLaVerde(map);
        if (resolvedTheme === "dark") aplicarTemaMapa(map, "oscuro");

        /* Click para colocar pin */
        map.on("click", (e) => {
          handlePick(e.lngLat.lat, e.lngLat.lng);
        });

        mapaRef.current = map;

        /* Colocar el marcador arrastrable si ya hay valor */
        if (value) {
          addOrMoveMarker(map, value.lat, value.lng);
        }
      });
    }

    void init().catch(() => {});

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  /* ── Tema ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapaRef.current) return;
    aplicarTemaMapa(mapaRef.current, resolvedTheme === "dark" ? "oscuro" : "claro");
  }, [resolvedTheme]);

  /* ── Mover/crear marcador cuando cambia value ───────────────────────────── */
  useEffect(() => {
    const map = mapaRef.current;
    if (!map) return;
    if (value) {
      addOrMoveMarker(map, value.lat, value.lng);
    } else {
      markerRef.current?.remove();
      markerRef.current = null;
    }
  }, [value]);

  /* ── Volar a flyTarget ──────────────────────────────────────────────────── */
  const lastFlyKey = useRef("");
  useEffect(() => {
    if (!mapaRef.current || !flyTarget) return;
    const key = `${flyTarget.lat.toFixed(6)},${flyTarget.lng.toFixed(6)}@${flyZoom}`;
    if (key === lastFlyKey.current) return;
    lastFlyKey.current = key;
    mapaRef.current.flyTo({ center: [flyTarget.lng, flyTarget.lat], zoom: flyZoom, duration: 800 });
  }, [flyTarget, flyZoom]);

  function addOrMoveMarker(map: maplibregl.Map, lat: number, lng: number) {
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
      return;
    }

    const el = document.createElement("div");
    el.style.cssText = `
      width:${PIN_STYLES.project.width}px;
      height:${PIN_STYLES.project.height}px;
      cursor:grab;
      filter:drop-shadow(0 3px 6px rgba(8,19,13,0.45));
    `;
    const { svg } = buildPinSvg("project", "map-pin");
    el.innerHTML = svg;

    const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: "bottom" })
      .setLngLat([lng, lat])
      .addTo(map);

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      handlePick(lngLat.lat, lngLat.lng);
    });

    markerRef.current = marker;
  }

  if (!mounted) {
    return <div className="h-full w-full bg-sand-deep" />;
  }

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" style={{ backgroundColor: "#F1F5EE" }} />
      {error && (
        <div className="absolute bottom-gap-sm inset-x-gap-sm z-[500] pointer-events-none">
          <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-gap-sm py-[7px] text-meta font-medium text-destructive">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
