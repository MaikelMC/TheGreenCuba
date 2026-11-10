"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import maplibregl from "maplibre-gl";
import { PlacePopup } from "./PlacePopup";
import { aplicarColoresLaVerde, aplicarTemaMapa } from "@/lib/map/tema-mapa";
import { buildPinSvg, parsePinImageId, pinImageId, PIN_STYLES } from "./pin-icon";
import type { PlacePinVariant } from "./pin-icon";
import { filterValidPlaces } from "@/lib/map/coordinates";
import {
  CUBA_BOUNDS,
  HAVANA_CENTER,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  GEO_ZOOM,
  LIBERTY_STYLE_URL,
  MAP_ATTRIBUTION,
  PITCH_3D,
  BEARING_3D,
} from "@/lib/map/map-config";
import { placeIcon } from "@/lib/places";
import { tieneRespaldo } from "@/lib/energia";
import { hayOferta } from "@/lib/ofertas";
import type { MapPlace, MapViewProps } from "./types";

/* ── Constantes de capas y fuentes ─────────────────────────────────────── */
const SOURCE_NEGOCIOS = "negocios";
const SOURCE_RUTA = "ruta";
const SOURCE_USUARIO = "usuario";
const LAYER_PINS = "pins";
const LAYER_RUTA_CASE = "ruta-case";
const LAYER_RUTA_CORE = "ruta-core";
const LAYER_USUARIO_PRECISION = "usuario-precision";
const LAYER_USUARIO_DOT = "usuario-dot";

/* ── Helpers GeoJSON ────────────────────────────────────────────────────── */
function placesToGeoJSON(places: MapPlace[], selectedId: string | null | undefined): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: places.map((p) => ({
      type: "Feature",
      id: p.id,
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        iconKey: placeIcon(p.icon, p.category),
        conEnergia: tieneRespaldo(p.energiaRespaldo),
        conOferta: hayOferta(p.ofertas),
        isProject: p.isProject ?? false,
        isBoosted: p.tags?.some((t) => t.label === "Destacado") ?? false,
        isSelected: p.id === selectedId,
      },
    })),
  };
}

function routeToGeoJSON(coords: [number, number][]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: coords.length === 0 ? [] : [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords.map(([lat, lng]) => [lng, lat]) },
        properties: {},
      },
    ],
  };
}

function userToGeoJSON(loc: { lat: number; lng: number; accuracy?: number } | null): GeoJSON.FeatureCollection {
  if (!loc) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [loc.lng, loc.lat] },
        properties: { accuracy: loc.accuracy ?? 0 },
      },
    ],
  };
}

/* ── Caché de imágenes de pin ────────────────────────────────────────────
   MapLibre no reintenta un símbolo después de que `styleimagemissing` ha
   disparado y el handler volvió sin añadir la imagen sincrónamente.
   Solución: pre-cargamos los HTMLImageElement antes de llamar a setData.
   Cuando styleimagemissing dispara, la imagen ya está lista → addImage
   síncrono → sin warning → pin visible. */
const pinCache = new Map<string, HTMLImageElement>();

/** Carga un SVG de pin y guarda el HTMLImageElement en caché. */
function precargarPin(id: string): Promise<void> {
  if (pinCache.has(id)) return Promise.resolve();
  const parsed = parsePinImageId(id);
  if (!parsed) return Promise.resolve();
  const { svg } = buildPinSvg(parsed.variant, parsed.iconKey, parsed.conEnergia, parsed.conOferta);
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => { pinCache.set(id, img); resolve(); };
    img.onerror = () => resolve();          // nunca rechaza; se omite
    img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
  });
}

/** Añade al mapa la imagen que ya debe estar en caché. Síncrono. */
function registrarDesdeCache(map: maplibregl.Map, id: string): void {
  if (map.hasImage(id)) return;
  const img = pinCache.get(id);
  if (!img) return;
  map.addImage(id, img, { pixelRatio: 2 });
}

/* ── Expresión de icon-image según propiedades del feature ─────────────── */
const ICON_IMAGE_EXPR: maplibregl.ExpressionSpecification = [
  "case",
  ["get", "isSelected"],
  ["concat", "pin-selected-", ["get", "iconKey"],
    ["case", ["get", "conEnergia"], "-e", ""],
    ["case", ["get", "conOferta"],  "-o", ""]],
  ["get", "isProject"],
  ["concat", "pin-project-",  ["get", "iconKey"], ""],
  ["get", "isBoosted"],
  ["concat", "pin-boosted-",  ["get", "iconKey"],
    ["case", ["get", "conEnergia"], "-e", ""],
    ["case", ["get", "conOferta"],  "-o", ""]],
  ["concat", "pin-default-",  ["get", "iconKey"],
    ["case", ["get", "conEnergia"], "-e", ""],
    ["case", ["get", "conOferta"],  "-o", ""]],
];

/* Tamaño de icono según estado: 1 = tamaño nativo (mitad del SVG, ya x2). */
const ICON_SIZE_EXPR: maplibregl.ExpressionSpecification = [
  "case",
  ["get", "isSelected"], 1,
  ["get", "isProject"],  1,
  ["get", "isBoosted"],  1,
  1,
];

/* ── MapContent ──────────────────────────────────────────────────────────── */
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
  disableAutoFit,
  vista3d = false,
  onVista3dChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<maplibregl.Map | null>(null);
  const { resolvedTheme } = useTheme();
  const validPlaces = useMemo(() => filterValidPlaces(places), [places]);

  // Estado del popup: qué negocio está abierto y el nodo DOM del popup.
  const [popupPlace, setPopupPlace] = useState<MapPlace | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const popupNodeRef = useRef<HTMLDivElement | null>(null);

  /* Ref siempre actualizado con validPlaces (lugares llegan async). */
  const validPlacesRef = useRef<MapPlace[]>([]);
  useEffect(() => { validPlacesRef.current = validPlaces; }, [validPlaces]);

  /* GeoJSON actual del source de negocios — necesario para forzar re-layout
     cuando styleimagemissing llega tarde (pin seleccionado, boosted, etc.). */
  const geoJSONRef = useRef<GeoJSON.FeatureCollection>({ type: "FeatureCollection", features: [] });

  /* Guards de un solo vuelo */
  const hasFit = useRef(false);
  const lastFlownUser = useRef<string>("");
  const lastFocusKey = useRef<number | null>(null);
  const lastViewKey = useRef<number | null>(null);
  const lastInitialCenter = useRef<string>("");

  /* ── Inicializar mapa ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    async function init() {
      if (cancelled || !containerRef.current) return;

      const center: [number, number] = userLocation
        ? [userLocation.lng, userLocation.lat]
        : [initialCenter[0], initialCenter[1]];

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: LIBERTY_STYLE_URL,
        center,
        zoom: initialZoom,
        minZoom: MIN_ZOOM,
        maxZoom,
        maxBounds: CUBA_BOUNDS,
        fadeDuration: 100,
        attributionControl: false,
      });

      /* Atribución compacta personalizada */
      map.addControl(
        new maplibregl.AttributionControl({ compact: true, customAttribution: MAP_ATTRIBUTION }),
        "bottom-right",
      );

      /* Control de zoom y brújula */
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");

      /* styleimagemissing: síncrono desde caché.
         Si la imagen ya está precargada → addImage inmediato → pin visible.
         Si no (pin seleccionado que llegó tarde, etc.) → carga async y fuerza
         re-layout repasando setData con el GeoJSON actual. */
      map.on("styleimagemissing", (e) => {
        if (!parsePinImageId(e.id)) return;
        if (pinCache.has(e.id)) {
          registrarDesdeCache(map, e.id);
        } else {
          void precargarPin(e.id).then(() => {
            registrarDesdeCache(map, e.id);
            const src = map.getSource(SOURCE_NEGOCIOS) as maplibregl.GeoJSONSource | undefined;
            src?.setData(geoJSONRef.current);
          });
        }
      });

      map.on("load", () => {
        if (cancelled) { map.remove(); return; }

        /* Paleta La Verde sobre Liberty, luego dark mode encima si aplica */
        aplicarColoresLaVerde(map);
        if (resolvedTheme === "dark") {
          aplicarTemaMapa(map, "oscuro");
        }

        /* Fuentes GeoJSON */
        map.addSource(SOURCE_NEGOCIOS, {
          type: "geojson",
          data: placesToGeoJSON(validPlaces, selectedPlaceId),
          generateId: false,
        });

        map.addSource(SOURCE_RUTA, {
          type: "geojson",
          data: routeToGeoJSON(route?.coordinates ?? []),
        });

        map.addSource(SOURCE_USUARIO, {
          type: "geojson",
          data: userToGeoJSON(userLocation ?? null),
        });

        /* Capas de ruta */
        map.addLayer({
          id: LAYER_RUTA_CASE,
          type: "line",
          source: SOURCE_RUTA,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#FFFFFF", "line-width": 11, "line-opacity": 0.9 },
        });
        map.addLayer({
          id: LAYER_RUTA_CORE,
          type: "line",
          source: SOURCE_RUTA,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#35AF6D", "line-width": 6 },
        });

        /* Capas de ubicación del usuario */
        map.addLayer({
          id: LAYER_USUARIO_PRECISION,
          type: "circle",
          source: SOURCE_USUARIO,
          paint: {
            "circle-radius": ["get", "accuracy"],
            "circle-color": "rgba(8,19,13,0.06)",
            "circle-stroke-color": "rgba(8,19,13,0.30)",
            "circle-stroke-width": 1.5,
            "circle-pitch-alignment": "map",
          },
        });
        map.addLayer({
          id: LAYER_USUARIO_DOT,
          type: "circle",
          source: SOURCE_USUARIO,
          paint: {
            "circle-radius": 7,
            "circle-color": "#08130D",
            "circle-stroke-color": "#FFFFFF",
            "circle-stroke-width": 2.5,
            "circle-pitch-alignment": "viewport",
          },
        });

        /* Capa de pines de negocios */
        map.addLayer({
          id: LAYER_PINS,
          type: "symbol",
          source: SOURCE_NEGOCIOS,
          layout: {
            "icon-image": ICON_IMAGE_EXPR,
            "icon-size": ICON_SIZE_EXPR,
            "icon-anchor": "bottom",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "symbol-sort-key": ["case", ["get", "isSelected"], 3, ["get", "isBoosted"], 2, 1],
          },
        });

        /* Eventos del mapa */
        map.on("click", LAYER_PINS, (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const id = feature.properties.id as string;
          const place = validPlacesRef.current.find((p) => p.id === id);
          if (!place) return;

          onPlaceSelect?.(place);

          // Cerrar popup anterior
          popupRef.current?.remove();

          const node = document.createElement("div");
          const popup = new maplibregl.Popup({
            closeButton: true,
            maxWidth: "300px",
            offset: [0, -(PIN_STYLES.default.height)],
            className: "lv-popup",
          })
            .setLngLat([place.lng, place.lat])
            .setDOMContent(node)
            .addTo(map);

          popup.on("close", () => {
            setPopupPlace(null);
            popupNodeRef.current = null;
            popupRef.current = null;
          });

          popupRef.current = popup;
          popupNodeRef.current = node;
          setPopupPlace(place);
        });

        /* Click en fondo del mapa */
        map.on("click", (e) => {
          if (e.defaultPrevented) return;
          const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_PINS] });
          if (features.length === 0) {
            onMapClick?.();
            popupRef.current?.remove();
          }
        });

        /* Bloquear propagación del click en la ruta */
        map.on("click", LAYER_RUTA_CASE, (e) => { e.preventDefault(); });
        map.on("click", LAYER_RUTA_CORE, (e) => { e.preventDefault(); });

        /* Cursor */
        map.on("mouseenter", LAYER_PINS, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", LAYER_PINS, () => { map.getCanvas().style.cursor = ""; });

        /* Evento moveend */
        map.on("moveend", () => {
          if (!onMapMove) return;
          const b = map.getBounds();
          const c = map.getCenter();
          onMapMove(
            { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
            [c.lat, c.lng],
            map.getZoom(),
          );
        });

        setMapa(map);
      });
    }

    void init().catch(() => { /* sin red al montar: el contenedor queda en color de fondo */ });

    return () => {
      cancelled = true;
      mapa?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Vista 3D ─────────────────────────────────────────────────────────────
     Los gestos ya vienen activos de MapLibre (`dragRotate` y `touchPitch`), así
     que aquí solo se lleva la cámara a la vista inclinada y se devuelve a plano.
     Con `prefers-reduced-motion` se salta sin animación: 900 ms de vuelo son
     justo el tipo de movimiento que esa preferencia pide evitar. */
  const vista3dAplicada = useRef(false);
  useEffect(() => {
    if (!mapa) return;

    /* Al montar `vista3d` es false: un `jumpTo` a plano borraría la vista
       restaurada (el mapa se abre donde lo dejó el usuario). */
    if (!vista3dAplicada.current) {
      vista3dAplicada.current = true;
      if (!vista3d) return;
    }

    const vista = vista3d
      ? { pitch: PITCH_3D, bearing: BEARING_3D }
      : { pitch: 0, bearing: 0 };
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (sinMovimiento) mapa.jumpTo(vista);
    else mapa.easeTo({ ...vista, duration: 900 });
  }, [mapa, vista3d]);

  /* El dedo puede deshacer la inclinación sin tocar el botón. `pitchend` llega
     al soltar el gesto y también al terminar el `easeTo`, así que el estado de
     fuera sigue a lo que de verdad se ve. */
  useEffect(() => {
    if (!mapa || !onVista3dChange) return;
    const alSoltar = () => onVista3dChange(mapa.getPitch() > 5);
    mapa.on("pitchend", alSoltar);
    return () => {
      mapa.off("pitchend", alSoltar);
    };
  }, [mapa, onVista3dChange]);

  /* ── Tema ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapa) return;
    aplicarTemaMapa(mapa, resolvedTheme === "dark" ? "oscuro" : "claro");
  }, [mapa, resolvedTheme]);

  /* ── Actualizar pines cuando cambian places o selected ─────────────────── */
  useEffect(() => {
    if (!mapa) return;
    const src = mapa.getSource(SOURCE_NEGOCIOS) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    if (popupPlace && !validPlaces.find((p) => p.id === popupPlace.id)) {
      popupRef.current?.remove();
    }

    const geojson = placesToGeoJSON(validPlaces, selectedPlaceId);
    geoJSONRef.current = geojson;

    /* Ids de imagen que necesita este set de places. */
    const neededIds = [...new Set(geojson.features.map((f) => {
      const p = f.properties!;
      const v: PlacePinVariant =
        p.isSelected ? "selected" : p.isProject ? "project" : p.isBoosted ? "boosted" : "default";
      return pinImageId(v, p.iconKey as string, p.conEnergia as boolean, p.conOferta as boolean);
    }))];

    /* Pre-cargar imágenes que faltan, luego registrar y setData.
       setData se llama solo después de que las imágenes estén listas para que
       styleimagemissing pueda añadirlas síncronamente cuando MapLibre las pida. */
    const faltantes = neededIds.filter((id) => !pinCache.has(id));
    const actualizarMapa = () => {
      for (const id of neededIds) registrarDesdeCache(mapa, id);
      src.setData(geojson);
    };

    if (faltantes.length === 0) {
      actualizarMapa();
    } else {
      void Promise.all(faltantes.map(precargarPin)).then(actualizarMapa);
    }
  }, [mapa, validPlaces, selectedPlaceId, popupPlace]);

  /* ── Actualizar ruta ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapa) return;
    const src = mapa.getSource(SOURCE_RUTA) as maplibregl.GeoJSONSource | undefined;
    src?.setData(routeToGeoJSON(route?.coordinates ?? []));

    if (route && routeOrigin && route.coordinates.length > 0) {
      const coords: [number, number][] = route.coordinates.map(([lat, lng]) => [lng, lat]);
      const bounds = coords.reduce(
        (b, c) => b.extend(c as [number, number]),
        new maplibregl.LngLatBounds(coords[0]!, coords[0]!),
      );
      mapa.fitBounds(bounds, { padding: 60, maxZoom: 16 });
    }
  }, [mapa, route, routeOrigin]);

  /* ── Actualizar ubicación del usuario ───────────────────────────────────── */
  useEffect(() => {
    if (!mapa) return;
    const src = mapa.getSource(SOURCE_USUARIO) as maplibregl.GeoJSONSource | undefined;
    src?.setData(userToGeoJSON(userLocation ?? null));

    if (!userLocation) return;
    const key = `${userLocation.lat.toFixed(5)},${userLocation.lng.toFixed(5)}`;
    if (key === lastFlownUser.current) return;
    lastFlownUser.current = key;
    mapa.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: Math.max(mapa.getZoom(), GEO_ZOOM), duration: 800 });
    onUserLocated?.(userLocation.lat, userLocation.lng, userLocation.accuracy);
  }, [mapa, userLocation, onUserLocated]);

  /* ── Auto-fit en el primer render con places ───────────────────────────── */
  useEffect(() => {
    if (!mapa || hasFit.current || validPlaces.length === 0 || userLocation || route || disableAutoFit) return;
    hasFit.current = true;
    if (validPlaces.length === 1) {
      mapa.flyTo({ center: [validPlaces[0]!.lng, validPlaces[0]!.lat], zoom: 15, duration: 800 });
    } else {
      const coords = validPlaces.map((p): [number, number] => [p.lng, p.lat]);
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(coords[0]!, coords[0]!),
      );
      mapa.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    }
  }, [mapa, validPlaces, userLocation, route, disableAutoFit]);

  /* ── Centro inicial (desde zona elegida en el buscador) ─────────────────── */
  useEffect(() => {
    if (!mapa || !initialCenter || userLocation) return;
    const key = `${initialCenter[0]},${initialCenter[1]}`;
    if (key === lastInitialCenter.current) return;
    lastInitialCenter.current = key;
    mapa.flyTo({ center: [initialCenter[0], initialCenter[1]], zoom: initialZoom, duration: 800 });
  }, [mapa, initialCenter, initialZoom, userLocation]);

  /* ── focusTarget (botón de ubicación de una card) ───────────────────────── */
  useEffect(() => {
    if (!mapa || !focusTarget) return;
    if (lastFocusKey.current === focusTarget.key) return;
    lastFocusKey.current = focusTarget.key;
    mapa.flyTo({ center: [focusTarget.lng, focusTarget.lat], zoom: 16, duration: 800 });
  }, [mapa, focusTarget]);

  /* ── viewTarget (geocodificador) ────────────────────────────────────────── */
  useEffect(() => {
    if (!mapa || !viewTarget) return;
    if (lastViewKey.current === viewTarget.key) return;
    lastViewKey.current = viewTarget.key;
    mapa.flyTo({ center: [viewTarget.lng, viewTarget.lat], zoom: viewTarget.zoom ?? 17, duration: 800 });
  }, [mapa, viewTarget]);

  /* ── Color de fondo antes de que cargue el mapa ─────────────────────────── */
  const mapBg = resolvedTheme === "dark" ? "#141B17" : "#F1F5EE";

  return (
    <>
      {/* Preconexión a OpenFreeMap — sin dominio externo cuando vengan del VPS */}
      <link rel="preconnect" href="https://tiles.openfreemap.org" />

      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ backgroundColor: mapBg }}
      />

      {/* Botón de ubicación: recibe el mapa por estado, no por ref */}
      {mapa && (
        <LocateButtonML
          mapa={mapa}
          onUserLocated={onUserLocated}
          onLocateStateChange={onLocateStateChange}
        />
      )}

      {/* Popup: portal desde este árbol React al nodo DOM del popup de MapLibre */}
      {popupPlace && popupNodeRef.current && createPortal(
        <PlacePopup
          place={popupPlace}
          onRoute={onPlaceRoute}
          routeFixed={popupPlace.id === routePlaceId}
          onRouteClear={onRouteClear}
        />,
        popupNodeRef.current,
      )}
    </>
  );
}

/* ── LocateButton integrado ──────────────────────────────────────────────
   Se mueve aquí para recibir el mapa como prop de estado (no como ref) y
   así React sabe que el mapa ya está listo. */
import { memo, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getCurrentPosition, GEO_ERROR_MESSAGES } from "@/lib/map/geolocation";
import type { LocateState } from "./types";

const LocateButtonML = memo(function LocateButtonML({
  mapa,
  onUserLocated,
  onLocateStateChange,
}: {
  mapa: maplibregl.Map;
  onUserLocated?: (lat: number, lng: number, accuracy?: number) => void;
  onLocateStateChange?: (state: LocateState) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [done, setDone] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    setDone(false);
    onLocateStateChange?.("loading");
    try {
      const pos = await getCurrentPosition({ useCache: false });
      if (!alive.current) return;
      setLocating(false);
      setDone(true);
      if (doneTimer.current) clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setDone(false), 1200);
      onLocateStateChange?.("success");
      mapa.flyTo({ center: [pos.lng, pos.lat], zoom: Math.max(mapa.getZoom(), GEO_ZOOM), duration: 800 });
      onUserLocated?.(pos.lat, pos.lng, pos.accuracy);
    } catch (err) {
      if (!alive.current) return;
      setLocating(false);
      const code = (err as { code?: string }).code as keyof typeof GEO_ERROR_MESSAGES | undefined;
      onLocateStateChange?.(code === "denied" ? "denied" : "error");
      toast.error(GEO_ERROR_MESSAGES[code ?? "unknown"] ?? GEO_ERROR_MESSAGES.unknown);
    }
  }, [locating, mapa, onLocateStateChange, onUserLocated]);

  const box =
    "flex size-[var(--map-ctrl-size)] items-center justify-center rounded-2xl border border-ink/5 bg-white shadow-soft";

  return (
    <div
      className="absolute left-2.5 z-10 bottom-[var(--map-locate-bottom)]"
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={locating}
        aria-label="Ir a mi ubicación"
        aria-busy={locating}
        className={cn(
          box,
          "relative cursor-pointer transition duration-500 ease-outquint hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400 active:scale-95 disabled:cursor-wait",
          done
            ? "border-verde-400 bg-verde-50 text-verde-600 ring-4 ring-verde-400/20"
            : "text-ink",
        )}
      >
        {locating && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl border border-verde-400 motion-safe:animate-ping"
          />
        )}
        {locating ? (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-verde-600">
            <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        ) : (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07-2.83 2.83M9.76 14.24l-2.83 2.83m0-10.14l2.83 2.83m4.48 4.48l2.83 2.83"/>
          </svg>
        )}
      </button>
    </div>
  );
});
