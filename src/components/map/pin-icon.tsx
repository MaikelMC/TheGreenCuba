import { renderToStaticMarkup } from "react-dom/server";
import { Percent } from "lucide-react";
import {
  DEFAULT_CATEGORY_ICON,
  isKnownIcon,
  resolveCategoryIcon,
} from "@/lib/category-icons";

/**
 * Generador de pines SVG para el mapa.
 *
 * Antes devolvía un `divIcon` de Leaflet. Ahora devuelve el HTML del SVG
 * (como string) para que MapContent lo convierta en imagen registrada con
 * `map.addImage()`. La lógica visual es idéntica.
 *
 * Convención de nombres de imagen en MapLibre:
 *   `pin-{variant}-{iconKey}[-e][-o]`
 * El evento `styleimagemissing` del mapa parsea ese nombre y llama a
 * `buildPinSvg` justo a tiempo, sin pre-registrar todas las combinaciones.
 */

export type PlacePinVariant = "default" | "boosted" | "selected" | "project";

interface PinStyle {
  width: number;
  height: number;
  discR: number;
  icon: number;
  ring?: boolean;
  ringColor?: string;
  top: string;
  bottom: string;
}

export const PIN_STYLES: Record<PlacePinVariant, PinStyle> = {
  default:  { width: 24, height: 36, discR: 7.5, icon: 10, top: "#35AF6D", bottom: "#0F7A41" },
  boosted:  { width: 30, height: 45, discR: 9,   icon: 12, top: "#0A4B2C", bottom: "#052017" },
  selected: { width: 34, height: 51, discR: 10,  icon: 13, ring: true, top: "#35AF6D", bottom: "#0F7A41" },
  project:  { width: 38, height: 56, discR: 11,  icon: 12, top: "#EF4444", bottom: "#B91C1C" },
};

const TEARDROP_PATH =
  "M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z";

function iconMarkup(iconKey: string, style: PinStyle): string {
  const key = isKnownIcon(iconKey) ? iconKey : DEFAULT_CATEGORY_ICON;
  const Icon = resolveCategoryIcon(key);
  const glyph = renderToStaticMarkup(<Icon size={24} strokeWidth={2.5} color="#08130D" />);
  const scale = style.icon / 24;
  return `<g transform="translate(12 12) scale(${scale.toFixed(4)}) translate(-12 -12)">${glyph}</g>`;
}

const ENERGIA_BADGE_MARKUP = `
  <g>
    <circle cx="19.2" cy="5.4" r="4.4" fill="white" stroke="#08130D" stroke-width="0.9"/>
    <path d="M19.9 3.3 17.8 6.05h1.5l-.9 1.75L20.6 5.1h-1.5z" fill="#08130D"/>
  </g>`;

function ofertaBadgeMarkup(): string {
  const glyph = renderToStaticMarkup(
    <Percent size={24} strokeWidth={3} color="#08130D" />,
  );
  const scale = 5 / 24;
  return `
  <g>
    <circle cx="4.8" cy="5.4" r="4.4" fill="white" stroke="#08130D" stroke-width="0.9"/>
    <g transform="translate(4.8 5.4) scale(${scale.toFixed(4)}) translate(-12 -12)">${glyph}</g>
  </g>`;
}

/**
 * Devuelve el HTML del SVG del pin (sin el div envolvente).
 *
 * Se registra en MapLibre con `pixelRatio: 2` a doble tamaño, así se ve
 * nítido en pantallas HiDPI sin necesidad de un segundo set de imágenes.
 */
export function buildPinSvg(
  variant: PlacePinVariant = "default",
  iconKey: string = DEFAULT_CATEGORY_ICON,
  conEnergia = false,
  conOferta = false,
): { svg: string; width: number; height: number } {
  const style = PIN_STYLES[variant];
  const { width, height, discR, ring, top, bottom } = style;
  const key = isKnownIcon(iconKey) ? iconKey : DEFAULT_CATEGORY_ICON;
  const gradId = `lv-pin-${variant}-${key}`;
  const ringColor = style.ringColor ?? "rgba(53,175,109,0.4)";

  const svg = `<svg viewBox="0 0 24 36" width="${width * 2}" height="${height * 2}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow-${gradId}" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(8,19,13,0.45)"/>
    </filter>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/>
      <stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
  </defs>
  <g filter="url(#shadow-${gradId})">
    <path d="${TEARDROP_PATH}" fill="url(#${gradId})"/>
    <circle cx="12" cy="12" r="${discR}" fill="white"/>
    ${iconMarkup(key, style)}
    ${ring ? `<circle cx="12" cy="12" r="8" fill="none" stroke="${ringColor}" stroke-width="2"/>` : ""}
    ${conEnergia ? ENERGIA_BADGE_MARKUP : ""}
    ${conOferta ? ofertaBadgeMarkup() : ""}
  </g>
</svg>`;

  return { svg, width: width * 2, height: height * 2 };
}

/** Parsea el id de imagen de MapLibre y llama a buildPinSvg. */
export function parsePinImageId(id: string): {
  variant: PlacePinVariant;
  iconKey: string;
  conEnergia: boolean;
  conOferta: boolean;
} | null {
  // formato: pin-{variant}-{iconKey}[-e][-o]
  const m = id.match(/^pin-(default|boosted|selected|project)-(.+?)(-e)?(-o)?$/);
  if (!m) return null;
  return {
    variant: m[1] as PlacePinVariant,
    iconKey: m[2]!,
    conEnergia: m[3] === "-e",
    conOferta: m[4] === "-o",
  };
}

/** Nombre de imagen para un lugar, según su estado. */
export function pinImageId(
  variant: PlacePinVariant,
  iconKey: string,
  conEnergia: boolean,
  conOferta: boolean,
): string {
  return `pin-${variant}-${iconKey}${conEnergia ? "-e" : ""}${conOferta ? "-o" : ""}`;
}
