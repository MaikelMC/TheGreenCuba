"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Navigation, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { categoryEmoji } from "@/lib/places";
import { type MapPlace } from "./types";

interface PlacePopupProps {
  place: MapPlace;
  onRoute?: (place: MapPlace) => void;
}

// Caja común de las dos acciones. 36 px de alto en vez de los 44 de la guía
// táctil: el popup es un aviso compacto y los botones a 44 px lo hacían más
// alto que el propio contenido. Siguen por encima del mínimo AA de 24 px.
const ACTION =
  "flex-1 min-h-9 inline-flex items-center justify-center gap-[5px] rounded-full px-3 " +
  "font-lv-display text-small font-semibold whitespace-nowrap " +
  "transition-all duration-500 ease-outquint active:scale-[0.98] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400";

const META = "font-lv-display text-meta tabular-nums";

export function PlacePopup({ place, onRoute }: PlacePopupProps) {
  // Una sola línea de datos. El barrio se omite a propósito: el mapa ya dice
  // dónde está, y la distancia es la que aporta algo.
  const segments: ReactNode[] = [
    <span key="cat" className={cn(META, "font-medium text-ink")}>
      <span aria-hidden className="mr-[3px]">
        {categoryEmoji(place.category)}
      </span>
      {place.category}
    </span>,
  ];

  if (place.rating) {
    segments.push(
      <span key="rating" className={cn(META, "inline-flex items-center gap-[3px] font-semibold text-verde-600")}>
        <Star size={11} fill="currentColor" className="shrink-0" />
        {place.rating}
      </span>,
    );
  }
  if (place.distance) {
    segments.push(
      <span key="dist" className={cn(META, "text-ink-soft/75")}>
        {place.distance}
      </span>,
    );
  }
  if (place.price) {
    segments.push(
      <span key="price" className={cn(META, "text-ink-soft/75")}>
        {place.price}
      </span>,
    );
  }

  return (
    <div className="w-[260px] font-lv text-ink">
      {/* El `pr` deja libre el botón de cerrar de Leaflet, que va posicionado
          encima de la esquina superior derecha. */}
      <div className="px-[14px] pt-[14px] pr-[36px]">
        <div className="font-lv-display text-body font-semibold leading-[1.25] tracking-[-0.01em] text-ink">
          {place.name}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-[6px] gap-y-[2px] px-[14px] pt-[6px] text-ink-soft/75">
        {segments.map((segment, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <span aria-hidden className="text-[10px] opacity-40">
                ·
              </span>
            )}
            {segment}
          </Fragment>
        ))}
      </div>

      {/* La ruta es la acción secundaria; abrir la ficha es la principal, así que
          va en el verde de acción y a la derecha. */}
      <div className="flex gap-gap-xs px-[14px] pt-[10px] pb-[12px]">
        {onRoute && (
          <button
            type="button"
            onClick={() => onRoute(place)}
            className={cn(
              ACTION,
              "border border-ink/10 bg-white text-ink hover:border-verde-300 hover:bg-verde-50",
            )}
          >
            <Navigation size={15} strokeWidth={1.8} />
            Ruta
          </button>
        )}
        {/* `Link` y no `<a>`: con un enlace normal la navegación recargaba la
            app entera, el PlacesProvider se volvía a montar y la ficha del
            lugar parpadeaba en "Lugar no encontrado" hasta hidratar.

            El `!` es aparte: Leaflet colorea todo `<a>` del mapa con
            `.leaflet-container a` (0,1,1), que gana a la utilidad suelta
            (0,1,0). Sin el `!` el texto salía en el azul #0078A8 de Leaflet. */}
        <Link
          href={`/place/${place.id}`}
          data-place-id={place.id}
          className={cn(ACTION, "bg-verde-400 !text-verde-950 hover:bg-verde-300")}
        >
          Ver más
          <ChevronRight size={15} strokeWidth={1.8} />
        </Link>
      </div>
    </div>
  );
}

export function getPlacePopupOptions() {
  return {
    className: "custom-leaflet-popup",
    closeButton: true,
    maxWidth: 300,
    minWidth: 260,
    // Sin margen el popup quedaba pegado al borde superior, por debajo del
    // header fijo, y el botón de cerrar caía fuera de la zona alcanzable.
    autoPanPadding: [16, 20] as [number, number],
  };
}
