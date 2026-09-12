import { divIcon } from "leaflet";

/**
 * Pin "teardrop" de marca, portado del mapa de DemaDeploy (leaf-map.tsx).
 *
 * SVG con gradiente vertical, punto blanco central y, en los estados
 * destacado/seleccionado, un anillo exterior. El estado "boosted" conserva la
 * semántica ámbar del marcador destacado actual y su pulso.
 *
 * Se cachean solo 3 iconos (uno por variante) para que los ids de gradiente del
 * SVG sean únicos y no se repita DOM por cada marcador.
 */

export type PlacePinVariant = "default" | "boosted" | "selected";

interface PinStyle {
  width: number;
  height: number;
  dotR: number;
  ring?: boolean;
  top: string;
  bottom: string;
}

const PIN_STYLES: Record<PlacePinVariant, PinStyle> = {
  default: { width: 24, height: 36, dotR: 4, top: "#52D28A", bottom: "#0F7A41" },
  boosted: { width: 30, height: 45, dotR: 5, top: "#EFAF3C", bottom: "#B07414" },
  selected: { width: 34, height: 51, dotR: 5, ring: true, top: "#52D28A", bottom: "#0F7A41" },
};

const TEARDROP_PATH =
  "M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z";

function buildPin(variant: PlacePinVariant) {
  const { width, height, dotR, ring, top, bottom } = PIN_STYLES[variant];
  const id = `lv-pin-${variant}`;
  const html = `
    <div style="width:${width}px;height:${height}px;filter:drop-shadow(0 3px 6px rgba(8,19,13,0.45));${
      variant === "boosted" ? "animation:pulse-ring 2s ease-in-out infinite;" : ""
    }">
      <svg viewBox="0 0 24 36" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="display:block">
        <defs>
          <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${top}"/>
            <stop offset="1" stop-color="${bottom}"/>
          </linearGradient>
        </defs>
        <path d="${TEARDROP_PATH}" fill="url(#${id})"/>
        <circle cx="12" cy="12" r="${dotR}" fill="white"/>
        ${ring ? '<circle cx="12" cy="12" r="8" fill="none" stroke="rgba(53,175,109,0.4)" stroke-width="2"/>' : ""}
      </svg>
    </div>`;

  return divIcon({
    className: "",
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    html,
  });
}

const ICON_CACHE: Partial<Record<PlacePinVariant, ReturnType<typeof buildPin>>> = {};

/** Icono de lugar para el mapa. Usar una de las 3 variantes (cacheado). */
export function createPlacePinIcon(variant: PlacePinVariant = "default") {
  if (!ICON_CACHE[variant]) {
    ICON_CACHE[variant] = buildPin(variant);
  }
  return ICON_CACHE[variant]!;
}
