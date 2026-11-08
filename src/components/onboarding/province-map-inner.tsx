"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MIN_ZOOM, MAX_ZOOM, TILEJSON_URL, MAP_ATTRIBUTION } from "@/lib/map/map-config";
import { locationCenter } from "@/lib/user-preferences-store";
import { buildPinSvg, PIN_STYLES } from "@/components/map/pin-icon";
import type { StyleSpecification } from "maplibre-gl";

export function ProvinceMapInner({ location }: { location: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  /* Inicializar mapa una vez. */
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    async function init() {
      const response = await fetch("/mapa/estilo-la-verde.json");
      const style = await response.json() as StyleSpecification;
      (style.sources as Record<string, maplibregl.SourceSpecification>).openmaptiles = {
        type: "vector",
        url: TILEJSON_URL,
      };

      if (cancelled || !containerRef.current) return;

      /* locationCenter devuelve [lat, lng]; MapLibre usa [lng, lat]. */
      const [lat, lng] = locationCenter(location);

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [lng, lat],
        zoom: 11,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
          fadeDuration: 100,
        attributionControl: false,
        interactive: false,
      });

      map.addControl(
        new maplibregl.AttributionControl({ compact: true, customAttribution: MAP_ATTRIBUTION }),
        "bottom-right",
      );

      map.on("load", () => {
        if (cancelled) { map.remove(); return; }
        mapaRef.current = map;

        const el = document.createElement("div");
        el.style.cssText = `
          width:${PIN_STYLES.selected.width}px;
          height:${PIN_STYLES.selected.height}px;
          pointer-events:none;
          filter:drop-shadow(0 3px 6px rgba(8,19,13,0.35));
        `;
        const { svg } = buildPinSvg("selected", "map-pin");
        el.innerHTML = svg;

        markerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([lng, lat])
          .addTo(map);
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
  }, []);

  /* Volar a la provincia cuando cambia la selección. */
  useEffect(() => {
    const map = mapaRef.current;
    if (!map) return;
    const [lat, lng] = locationCenter(location);
    map.flyTo({ center: [lng, lat], zoom: 11, duration: 700 });
    markerRef.current?.setLngLat([lng, lat]);
  }, [location]);

  return (
    <div
      ref={containerRef}
      className="z-0 h-full w-full"
      style={{ background: "#F1F5EE" }}
    />
  );
}
