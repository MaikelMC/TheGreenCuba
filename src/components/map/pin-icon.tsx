import { divIcon } from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { Percent } from "lucide-react";
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

const PIN_STYLES: Record<PlacePinVariant, PinStyle> = {
  default: { width: 24, height: 36, discR: 7.5, icon: 10, top: "#35AF6D", bottom: "#0F7A41" },
  boosted: { width: 30, height: 45, discR: 9, icon: 12, top: "#0A4B2C", bottom: "#052017" },
  selected: { width: 34, height: 51, discR: 10, icon: 13, ring: true, top: "#35AF6D", bottom: "#0F7A41" },
  project: { width: 38, height: 56, discR: 11, icon: 12, top: "#EF4444", bottom: "#B91C1C" },
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

function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("'", "&apos;");
}

function imageClipId(imageUrl: string): string {
  let hash = 2166136261;
  for (let index = 0; index < imageUrl.length; index += 1) {
    hash = Math.imul(hash ^ imageUrl.charCodeAt(index), 16777619);
  }
  return `lv-pin-photo-${(hash >>> 0).toString(36)}`;
}

/**
 * El rayo del pin: un disco blanco con el símbolo dentro, solapado al hombro
 * derecho de la gota.
 *
 * Va en el pin y no en el popup porque el pin es lo que se mira desde lejos,
 * con el mapa sin tocar: quien busca corriente tiene que poder recorrer el mapa
 * con la vista en vez de abrir ficha por ficha. El disco es blanco y el rayo
 * oscuro —el mismo `#08130D` de los iconos— porque la paleta no tiene ámbar y
 * un color inventado aquí se saldría del sistema.
 *
 * Las coordenadas están en unidades del `viewBox` (24×36), no en píxeles: el
 * icono se escala con el ancho y el alto de cada variante y el rayo tiene que
 * escalar con él. Se coloca con el canto derecho dentro del `viewBox` —
 * `cx 19.2` + `r 4.4` = 23.6 < 24— para que no lo recorte el SVG en la variante
 * más pequeña.
 */
const ENERGIA_BADGE_MARKUP = `
  <g>
    <circle cx="19.2" cy="5.4" r="4.4" fill="white" stroke="#08130D" stroke-width="0.9"/>
    <path d="M19.9 3.3 17.8 6.05h1.5l-.9 1.75L20.6 5.1h-1.5z" fill="#08130D"/>
  </g>`;

/**
 * El símbolo de la oferta: un disco blanco con un `%`, en el hombro **izquierdo**
 * de la gota.
 *
 * Al lado contrario del rayo, y no es un detalle: un negocio puede tener las dos
 * cosas a la vez —planta eléctrica y oferta— y apiladas en el mismo hombro el
 * segundo disco taparía al primero. El símbolo sale del mismo Lucide que los
 * iconos de categoría y se convierte igual, para no dibujar a mano un `%` que ya
 * existe en la librería.
 */
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

function buildPin(
  variant: PlacePinVariant,
  iconKey: string,
  imageUrl?: string,
  conEnergia = false,
  conOferta = false,
) {
  const { width, height, discR, ring, top, bottom } = PIN_STYLES[variant];
  const key = isKnownIcon(iconKey) ? iconKey : DEFAULT_CATEGORY_ICON;
  const id = `lv-pin-${variant}-${key}${conEnergia ? "-e" : ""}${conOferta ? "-o" : ""}`;
  const photoRadius = Math.max(3, discR - 1);
  const clipId = imageUrl ? imageClipId(imageUrl) : "";
  const centerContent = imageUrl
    ? `<image href="${escapeXmlAttribute(imageUrl)}" x="${12 - photoRadius}" y="${12 - photoRadius}" width="${photoRadius * 2}" height="${photoRadius * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/><circle cx="12" cy="12" r="${photoRadius}" fill="none" stroke="white" stroke-width="1"/>`
    : iconMarkup(key, PIN_STYLES[variant]);
  const html = `
    <div style="width:${width}px;height:${height}px;filter:drop-shadow(0 3px 6px rgba(8,19,13,0.45));${
      variant === "boosted" || variant === "project" ? "animation:pulse-ring 2s ease-in-out infinite;" : ""
    }">
      <svg viewBox="0 0 24 36" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="display:block">
        <defs>
          <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${top}"/>
            <stop offset="1" stop-color="${bottom}"/>
          </linearGradient>
          ${imageUrl ? `<clipPath id="${clipId}"><circle cx="12" cy="12" r="${photoRadius}"/></clipPath>` : ""}
        </defs>
        <path d="${TEARDROP_PATH}" fill="url(#${id})"/>
        <circle cx="12" cy="12" r="${discR}" fill="white"/>
        ${centerContent}
        ${ring ? `<circle cx="12" cy="12" r="8" fill="none" stroke="${PIN_STYLES[variant].ringColor ?? "rgba(53,175,109,0.4)"}" stroke-width="2"/>` : ""}
        ${conEnergia ? ENERGIA_BADGE_MARKUP : ""}
        ${conOferta ? ofertaBadgeMarkup() : ""}
      </svg>
    </div>`;

  return divIcon({
    className: "",
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    html,
  });
}

/* La clave lleva la variante, el icono, la foto, el rayo y la oferta: dos
   negocios distintos comparten variante pero no dibujo. */
const ICON_CACHE: Record<string, ReturnType<typeof buildPin>> = {};

/** Icono de lugar para el mapa, cacheado por variante, icono, respaldo y oferta. */
export function createPlacePinIcon(
  variant: PlacePinVariant = "default",
  iconKey: string = DEFAULT_CATEGORY_ICON,
  imageUrl?: string,
  /** Si el negocio tiene energía de respaldo. Ver `src/lib/energia.ts`. */
  conEnergia = false,
  /** Si tiene alguna oferta flash viva. Ver `hayOferta` en `src/lib/ofertas.ts`. */
  conOferta = false,
) {
  const cacheKey = `${variant}:${isKnownIcon(iconKey) ? iconKey : DEFAULT_CATEGORY_ICON}:${imageUrl ?? ""}:${conEnergia ? "e" : ""}:${conOferta ? "o" : ""}`;
  ICON_CACHE[cacheKey] ??= buildPin(variant, iconKey, imageUrl, conEnergia, conOferta);
  return ICON_CACHE[cacheKey]!;
}
