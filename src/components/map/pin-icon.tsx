import { divIcon } from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DEFAULT_CATEGORY_ICON,
  isKnownIcon,
  resolveCategoryIcon,
} from "@/lib/category-icons";

/**
 * Pin "teardrop" de marca, portado del mapa de DemaDeploy (leaf-map.tsx).
 *
 * SVG con gradiente vertical y, dentro de la gota, el icono del negocio sobre
 * un disco blanco. Antes había un punto blanco sin más: todos los pines eran el
 * mismo dibujo y el mapa no distinguía un restaurante de una playa.
 *
 * Los tres degradados salen de la escala `verde` del design system, nunca de
 * hex sueltos: el pin normal es el mismo degradado `verde-400 → verde-600` del
 * círculo del logo, y el destacado se separa por luminosidad con `verde-950 →
 * verde-800` en vez del ámbar anterior, que no existía en la paleta.
 *
 * El icono viene de Lucide, que es React, y un `divIcon` de Leaflet necesita
 * una cadena de HTML: lo que los une es `renderToStaticMarkup`. Se cachea cada
 * combinación de variante e icono para no repetir esa conversión en cada
 * marcador, y el `id` del degradado lleva las dos cosas para que dos pines
 * distintos no compartan gradiente.
 */

export type PlacePinVariant = "default" | "boosted" | "selected";

interface PinStyle {
  width: number;
  height: number;
  discR: number;
  icon: number;
  ring?: boolean;
  top: string;
  bottom: string;
}

const PIN_STYLES: Record<PlacePinVariant, PinStyle> = {
  default: { width: 24, height: 36, discR: 7.5, icon: 10, top: "#35AF6D", bottom: "#0F7A41" },
  boosted: { width: 30, height: 45, discR: 9, icon: 12, top: "#0A4B2C", bottom: "#052017" },
  selected: { width: 34, height: 51, discR: 10, icon: 13, ring: true, top: "#35AF6D", bottom: "#0F7A41" },
};

const TEARDROP_PATH =
  "M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z";

/* El icono de Lucide ocupa 24×24 y va centrado en (12,12) de la gota, que es
   donde estaba el punto blanco. Se escala con un `transform` y no con
   width/height: las medidas del SVG de Lucide ya vienen en 24 y así el trazo
   se mantiene proporcional. */
function iconMarkup(iconKey: string, style: PinStyle): string {
  const key = isKnownIcon(iconKey) ? iconKey : DEFAULT_CATEGORY_ICON;
  const Icon = resolveCategoryIcon(key);
  /* 2.5 y no los 2 de Lucide: el glifo se encoge a 10 unidades de las 24 del
     SVG, así que un trazo de 2 se queda en menos de un píxel y el icono se
     desdibuja justo en el tamaño en que más se mira, el pin normal. */
  const glyph = renderToStaticMarkup(<Icon size={24} strokeWidth={2.5} color="#08130D" />);
  const scale = style.icon / 24;

  return `<g transform="translate(12 12) scale(${scale.toFixed(4)}) translate(-12 -12)">${glyph}</g>`;
}

function buildPin(variant: PlacePinVariant, iconKey: string) {
  const { width, height, discR, ring, top, bottom } = PIN_STYLES[variant];
  const key = isKnownIcon(iconKey) ? iconKey : DEFAULT_CATEGORY_ICON;
  const id = `lv-pin-${variant}-${key}`;
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
        <circle cx="12" cy="12" r="${discR}" fill="white"/>
        ${iconMarkup(key, PIN_STYLES[variant])}
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

/* La clave lleva la variante y el icono: dos negocios distintos comparten
   variante pero no dibujo. */
const ICON_CACHE: Record<string, ReturnType<typeof buildPin>> = {};

/** Icono de lugar para el mapa, cacheado por variante e icono. */
export function createPlacePinIcon(
  variant: PlacePinVariant = "default",
  iconKey: string = DEFAULT_CATEGORY_ICON,
) {
  const key = `${variant}:${isKnownIcon(iconKey) ? iconKey : DEFAULT_CATEGORY_ICON}`;
  ICON_CACHE[key] ??= buildPin(variant, iconKey);
  return ICON_CACHE[key]!;
}
