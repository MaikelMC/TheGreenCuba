"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
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

/**
 * Mantiene el lienzo de Leaflet del tamaño real de su caja.
 *
 * Leaflet mide el contenedor una sola vez, al montar. En un móvil esa caja
 * cambia sola: la barra de URL de Safari se esconde, el teclado empuja el
 * layout al enfocar el buscador, el giro del teléfono lo reordena. Con la
 * medida vieja los mosaicos se pintan en el sitio equivocado, aparecen franjas
 * grises y el mapa deja de responder hasta recargar la página.
 *
 * Las señales se agrupan en un frame para no invalidar diez veces seguidas.
 * `pan: false` conserva el centro elegido por el usuario.
 */
function MapViewportSync() {
  const map = useMap();

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        map.invalidateSize({ pan: false, animate: false });
      });
    };

    const container = map.getContainer();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    observer?.observe(container);

    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", sync);

    function alVolver() {
      if (document.visibilityState === "visible") sync();
    }
    document.addEventListener("visibilitychange", alVolver);

    sync();

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      viewport?.removeEventListener("resize", sync);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [map]);

  return null;
}

function MapEventsHandler({
  onMapMove,
  onMapClick,
}: {
  onMapMove?: MapViewProps["onMapMove"];
  onMapClick?: MapViewProps["onMapClick"];
}) {
  /* `useMapEvents` desengancha y reengancha los eventos cada vez que cambia la
     identidad del objeto que recibe. Se creaba en cada render, así que
     cualquier cambio de estado del home volvía a suscribir el mapa entero. */
  const handlers = useMemo<L.LeafletEventHandlerFnMap>(
    () => ({
      // Los pines no burbujean al mapa (`bubblingMouseEvents: false` en
      // `L.Marker`), así que este click es siempre el del fondo del mapa.
      click: () => onMapClick?.(),
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
    }),
    [onMapMove, onMapClick],
  );

  useMapEvents(handlers);
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
    if (hasFit.current || places.length === 0 || hasUserLocation || disabled)
      return;
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
  routePlaceId,
  onRouteClear,
  userLocation,
  onUserLocated,
  onLocateStateChange,
  focusTarget,
  viewTarget,
  initialCenter,
  initialZoom,
}: {
  tile: ReturnType<typeof getTile>;
  places: MapPlace[];
  selectedPlaceId?: string | null;
  onPlaceSelect?: MapViewProps["onPlaceSelect"];
  onPlaceRoute?: MapViewProps["onPlaceRoute"];
  routePlaceId: MapViewProps["routePlaceId"];
  onRouteClear: MapViewProps["onRouteClear"];
  userLocation?: MapViewProps["userLocation"];
  onUserLocated?: MapViewProps["onUserLocated"];
  onLocateStateChange?: MapViewProps["onLocateStateChange"];
  focusTarget?: MapViewProps["focusTarget"];
  viewTarget?: MapViewProps["viewTarget"];
  initialCenter?: [number, number] | null;
  initialZoom: number;
}) {
  const [ready, setReady] = useState(false);
  const map = useMap();
  const lastFlownTo = useRef<{ lat: number; lng: number } | null>(null);
  const lastInitialCenter = useRef<[number, number] | null>(null);

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
    map.flyTo([userLocation.lat, userLocation.lng], GEO_ZOOM, {
      duration: 0.8,
    });
  }, [userLocation, map, ready]);

  useEffect(() => {
    if (!initialCenter || userLocation) return;
    if (
      lastInitialCenter.current?.[0] === initialCenter[0] &&
      lastInitialCenter.current?.[1] === initialCenter[1]
    ) {
      return;
    }
    lastInitialCenter.current = initialCenter;
    map.flyTo(initialCenter, initialZoom, { duration: 0.8 });
  }, [initialCenter, initialZoom, map, userLocation, ready]);

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
        subdomains={tile.subdomains ?? "ab"}
        detectRetina={DETECT_RETINA}
        /* crossOrigin evita respuestas opacas: sin él, Chrome guarda cada
           tesela como opaca y cada una ocupa 7 MB de cuota aunque solo pese
           10 KB. Con CORS normal el SW puede inspeccionar y cachear sin coste
           de cuota exagerado. Los servidores de OSM y CartoDB admiten CORS. */
        crossOrigin="anonymous"
        /* keepBuffer: Leaflet guarda más teselas alrededor de la vista para
           que al moverse ya estén. updateWhenZooming/Idle: no pedir teselas
           a mitad de la animación del zoom, sino cuando el mapa se queda
           quieto; elimina el vaciado de pantalla al hacer zoom en móvil. */
        keepBuffer={4}
        updateWhenZooming={false}
        updateWhenIdle={true}
      />
      <MapMarkers
        places={places}
        selectedId={selectedPlaceId}
        onSelect={onPlaceSelect}
        onRoute={onPlaceRoute}
        routePlaceId={routePlaceId}
        onRouteClear={onRouteClear}
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
  onMapClick,
  userLocation,
  onUserLocated,
  onLocateStateChange,
  focusTarget,
  viewTarget,
  route,
  routeOrigin,
  routePlaceId,
  onRouteClear,
  initialCenter = HAVANA_CENTER,
  initialZoom = DEFAULT_ZOOM,
  maxZoom = MAX_ZOOM,
  tileKey = DEFAULT_TILE,
  disableAutoFit,
}: MapViewProps) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const validPlaces = useMemo(() => filterValidPlaces(places), [places]);
  const hasUserLocation = Boolean(userLocation);
  const effectiveInitialCenter: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : (initialCenter ?? HAVANA_CENTER);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* Preconexión a los servidores de teselas. React 19 iza estas etiquetas al
     <head> automáticamente. Se limitan a los dos subdominios configurados en
     map-config.ts; los demás proveedores reciben solo dns-prefetch. */
  const preconnect = (
    <>
      <link rel="preconnect" href="https://a.tile.openstreetmap.org" />
      <link rel="preconnect" href="https://b.tile.openstreetmap.org" />
      <link rel="dns-prefetch" href="https://c.tile.openstreetmap.org" />
      <link rel="preconnect" href="https://a.basemaps.cartocdn.com" />
      <link rel="preconnect" href="https://b.basemaps.cartocdn.com" />
      <link rel="dns-prefetch" href="https://c.basemaps.cartocdn.com" />
      <link rel="dns-prefetch" href="https://d.basemaps.cartocdn.com" />
    </>
  );

  /* Color de fondo mientras carga la primera tanda de teselas.
     - Claro: #f2efe9 (tono tierra de la capa OSM estándar sobre zonas de Cuba).
     - Oscuro: #0e1720 (el mismo que .map-loading en globals.css, resultado de
       invertir el tile claro con el filtro CSS del modo oscuro). */
  const mapBg = resolvedTheme === "dark" ? "#0e1720" : "#f2efe9";

  if (!mounted) {
    return (
      <>
        {preconnect}
        <div
          className="h-full w-full"
          style={{ minHeight: "inherit", backgroundColor: mapBg }}
        />
      </>
    );
  }

  return (
    <>
      {preconnect}
      <MapContainer
      center={effectiveInitialCenter}
      zoom={initialZoom}
      minZoom={MIN_ZOOM}
      maxZoom={maxZoom}
      zoomControl={false}
      preferCanvas={PREFER_CANVAS}
      className={resolvedTheme === "dark" ? "z-0 dark-map-tiles" : "z-0"}
      style={{ height: "100%", width: "100%", backgroundColor: mapBg }}
    >
      <ZoomControl position="bottomleft" />
      <MapViewportSync />
      <MapEventsHandler onMapMove={onMapMove} onMapClick={onMapClick} />
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
        routePlaceId={routePlaceId}
        onRouteClear={onRouteClear}
        userLocation={userLocation}
        onUserLocated={onUserLocated}
        onLocateStateChange={onLocateStateChange}
        focusTarget={focusTarget}
        viewTarget={viewTarget}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
      />

      {route && routeOrigin && route.coordinates.length > 0 && (
        <RouteLayer route={route} origin={routeOrigin} />
      )}
    </MapContainer>
    </>
  );
}
