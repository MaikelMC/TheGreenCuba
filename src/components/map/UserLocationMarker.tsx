"use client";

import { memo, useMemo } from "react";
import { Circle, Marker, Popup } from "react-leaflet";
import { divIcon } from "leaflet";

interface UserLocationMarkerProps {
  lat: number;
  lng: number;
  accuracy?: number;
}

function createUserDot() {
  return divIcon({
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<div style="width:20px;height:20px;background:oklch(62% 0.14 250);border:3px solid white;border-radius:50%;box-shadow:0 2px 8px oklch(62% 0.14 250 / 0.3)"><div style="width:8px;height:8px;background:white;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)"></div></div>`,
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
            color: "oklch(62% 0.14 250)",
            fillColor: "oklch(62% 0.14 250 / 0.08)",
            fillOpacity: 0.3,
            weight: 1.5,
            dashArray: "4 4",
          }}
        />
      )}
      <Marker position={[lat, lng]} icon={icon} zIndexOffset={1000}>
        <Popup closeButton={false}>
          <div style={{ fontSize: "13px", fontWeight: 500 }}>Tu ubicación</div>
        </Popup>
      </Marker>
    </>
  );
});
