"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { Polyline, Marker, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import type { RouteResult, RoutePoint } from "@/lib/map/routing";

interface RouteLayerProps {
  route: RouteResult | null;
  origin: RoutePoint;
}

/* Origen de la ruta = donde está el usuario, así que va en `ink` igual que el
   punto "estás aquí" (UserLocationMarker), no en el verde de los lugares. */
function createOriginDot() {
  return divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<div style="width:14px;height:14px;background:#08130D;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(8,19,13,0.4)"></div>`,
  });
}

/* Estilo de ruta tipo Google Maps: una línea clara más gruesa por debajo hace
   de borde y la verde queda encima, resaltada sobre el mapa. Con una sola
   línea fina la ruta se perdía entre las calles del tile. */
const ROUTE_CASE = {
  color: "#FFFFFF",
  weight: 11,
  opacity: 0.9,
  lineCap: "round",
  lineJoin: "round",
} as const;

const ROUTE_CORE = {
  color: "#35AF6D", /* verde-400, el mismo del pin de destino */
  weight: 6,
  opacity: 1,
  lineCap: "round",
  lineJoin: "round",
} as const;

/* La ruta absorbe su propio click. `L.Path` burbujea al mapa por defecto, y el
   mapa lo lee como "clic fuera" y quita la selección. Hacen falta las dos
   cosas: un listener de click —sin él la línea no cuenta como objetivo y el
   evento sigue al mapa— y apagar el burbujeo. Va en las dos líneas porque el
   click cae en la que esté arriba. */
const ROUTE_CLICK_GUARD = {
  bubblingMouseEvents: false,
  eventHandlers: { click: () => {} },
};

/* El destino no lleva pin propio: lo pone el marcador del lugar, que ya está en
   esa misma coordenada y, al quedar seleccionado, sale en la variante `selected`
   —más grande—. El pin extra que había aquí se dibujaba encima del suyo, sin
   popup ni handler, y se comía el click: el destino dejaba de ser tocable. */
export const RouteLayer = memo(function RouteLayer({
  route,
  origin,
}: RouteLayerProps) {
  const map = useMap();
  const originIcon = useMemo(() => createOriginDot(), []);
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
        pathOptions={ROUTE_CASE}
        {...ROUTE_CLICK_GUARD}
      />
      <Polyline
        positions={route.coordinates}
        pathOptions={ROUTE_CORE}
        {...ROUTE_CLICK_GUARD}
      />
      <Marker position={[origin.lat, origin.lng]} icon={originIcon} />
    </>
  );
});
