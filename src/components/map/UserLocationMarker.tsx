"use client";

import { memo, useMemo } from "react";
import { Circle, Marker, Popup } from "react-leaflet";
import { divIcon } from "leaflet";

interface UserLocationMarkerProps {
  lat: number;
  lng: number;
  accuracy?: number;
}

/* Punto "estás aquí". Va en `ink` y no en el verde de los marcadores: así se
   distingue de un vistazo de los tres pines de lugar, que son todos verdes. El
   anillo y el punto blancos lo separan de cualquier pin. */
function createUserDot() {
  return divIcon({
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<div style="width:20px;height:20px;background:#08130D;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(8,19,13,0.3)"><div style="width:8px;height:8px;background:white;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)"></div></div>`,
  });
}

export const UserLocationMarker = memo(function UserLocationMarker({
  lat,
  lng,
  accuracy,
}: UserLocationMarkerProps) {
  const icon = useMemo(() => createUserDot(), []);

  return (
    <>
      {accuracy && accuracy > 0 && accuracy < 500 && (
        <Circle
          center={[lat, lng]}
          radius={accuracy}
          pathOptions={{
            color: "rgba(8, 19, 13, 0.30)",
            fillColor: "rgba(8, 19, 13, 0.06)",
            fillOpacity: 0.3,
            weight: 1.5,
            dashArray: "4 4",
          }}
        />
      )}
      <Marker position={[lat, lng]} icon={icon} zIndexOffset={1000}>
        {/* Mismo cromo que la tarjeta de lugar (`custom-leaflet-popup`), o
            Leaflet le pone su caja por defecto. */}
        <Popup closeButton={false} className="custom-leaflet-popup">
          <div className="px-[14px] py-[10px] font-lv-display text-small font-semibold text-ink">
            Tu ubicación
          </div>
        </Popup>
      </Marker>
    </>
  );
});
