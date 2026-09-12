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
  "flex-1 min-h-9 inline-flex items-center justify-center gap-[5px] rounded-lv px-3 " +
  "text-[13px] font-semibold whitespace-nowrap transition-colors active:scale-[0.98] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const META = "font-mono text-[12px] tabular-nums";

export function PlacePopup({ place, onRoute }: PlacePopupProps) {
  // Una sola línea de datos. El barrio se omite a propósito: el mapa ya dice
  // dónde está, y la distancia es la que aporta algo.
  const segments: ReactNode[] = [
    <span key="cat" className="text-[12px] font-medium text-foreground">
      <span aria-hidden className="mr-[3px]">
        {categoryEmoji(place.category)}
      </span>
      {place.category}
    </span>,
  ];

  if (place.rating) {
    segments.push(
      <span key="rating" className={cn(META, "inline-flex items-center gap-[3px] font-medium text-foreground")}>
        <Star size={11} fill="currentColor" className="shrink-0 text-lv-amber" />
        {place.rating}
      </span>,
    );
  }
  if (place.distance) {
    segments.push(
      <span key="dist" className={cn(META, "text-muted-foreground")}>
        {place.distance}
      </span>,
    );
  }
  if (place.price) {
    segments.push(
      <span key="price" className={cn(META, "text-muted-foreground")}>
        {place.price}
      </span>,
    );
  }

  return (
    <div className="w-[260px] font-body">
      {/* El `pr` deja libre el botón de cerrar de Leaflet, que va posicionado
          encima de la esquina superior derecha. */}
      <div className="px-[14px] pt-[14px] pr-[36px]">
        <div className="font-display text-[16px] font-semibold leading-[1.25] tracking-[-0.01em] text-foreground">
          {place.name}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-[6px] gap-y-[2px] px-[14px] pt-[6px] text-muted-foreground">
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
          va en accent y a la derecha. */}
      <div className="flex gap-gap-xs px-[14px] pt-[10px] pb-[12px]">
        {onRoute && (
          <button
            type="button"
            onClick={() => onRoute(place)}
            className={cn(
              ACTION,
              "border border-border bg-surface text-foreground hover:border-accent/40 hover:bg-accent/5",
            )}
          >
            <Navigation size={15} strokeWidth={2} />
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
          className={cn(ACTION, "bg-accent !text-accent-foreground hover:bg-accent/90")}
        >
          Ver más
          <ChevronRight size={15} strokeWidth={2} />
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
