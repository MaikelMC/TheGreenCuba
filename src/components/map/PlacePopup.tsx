"use client";

import { Fragment, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronRight, Navigation, Star, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { placeIcon } from "@/lib/places";
import { CategoryIcon } from "@/components/admin/category-icon";
import { type MapPlace } from "./types";

interface PlacePopupProps {
  place: MapPlace;
  onRoute?: (place: MapPlace) => void;
  /** Este lugar es el destino de la ruta pintada: el botón la muestra fijada. */
  routeFixed?: boolean;
  onRouteClear?: () => void;
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

export function PlacePopup({
  place,
  onRoute,
  routeFixed,
  onRouteClear,
}: PlacePopupProps) {
  const [coverFailed, setCoverFailed] = useState(false);

  // Una sola línea de datos. El barrio se omite a propósito: el mapa ya dice
  // dónde está, y la distancia es la que aporta algo.
  const segments: ReactNode[] = [
    /* El icono del negocio, el mismo que el del pin: el popup sale del pin, y
       ver un emoji aquí después de haber tocado un icono allí era cambiar de
       dibujo a mitad de camino. */
    <span key="cat" className={cn(META, "inline-flex items-center gap-[3px] font-medium text-ink")}>
      <CategoryIcon
        icon={placeIcon(place.icon, place.category)}
        size={12}
        strokeWidth={2}
        className="shrink-0"
      />
      {place.category}
    </span>,
  ];
  const featuredOffer = place.isProject ? place.offerPackages?.[0] : undefined;

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
      {/* Portada: la foto del negocio antes de entrar a la ficha. Es la misma
          que ya lleva el pin —logo, foto del mapa o portada, en ese orden—,
          solo que aquí cabe entera. Si la URL falla, el hueco desaparece en
          vez de dejar un rectángulo roto: la tarjeta sigue siendo la misma
          sin ella. */}
      {place.image && !coverFailed && (
        <div className="lv-popup-cover h-[84px] w-full border-b border-ink/5 bg-sand-deep">
          <img
            src={place.image}
            alt=""
            loading="lazy"
            onError={() => setCoverFailed(true)}
            className="h-full w-full object-cover"
          />
        </div>
      )}

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

      {featuredOffer && (
        <div className="mx-[14px] mt-2 rounded-lg border border-verde-200 bg-verde-50 px-2.5 py-2">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase text-verde-700">
            <Ticket size={12} /> Oferta principal
          </div>
          <p className="mt-0.5 truncate font-lv-display text-small font-semibold text-ink">{featuredOffer.title}</p>
          <p className="mt-0.5 truncate text-meta text-ink-soft/75">
            {[featuredOffer.price, featuredOffer.capacity ? `${featuredOffer.capacity} personas` : "", featuredOffer.includes[0] ?? ""]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {(place.offerPackages?.length ?? 0) > 1 && <p className="mt-1 text-meta font-medium text-verde-700">+{place.offerPackages!.length - 1} ofertas más</p>}
        </div>
      )}

      {/* La ruta es la acción secundaria; abrir la ficha es la principal, así que
          va en el verde de acción y a la derecha.

          El botón ocupa el mismo hueco en los dos estados: con la ruta puesta
          dice que está fijada y al tocarlo la quita, así que el mismo gesto que
          la pone la deshace, en el mismo sitio. */}
      <div className="flex gap-gap-xs px-[14px] pt-[10px] pb-[12px]">
        {routeFixed && onRouteClear ? (
          <button
            type="button"
            onClick={onRouteClear}
            aria-label="Quitar la ruta fijada"
            title="Quitar la ruta fijada"
            className={cn(
              ACTION,
              "border border-verde-300 bg-verde-50 text-verde-700 hover:bg-verde-100",
            )}
          >
            <Check size={15} strokeWidth={2.2} />
            Ruta fijada
          </button>
        ) : (
          onRoute && (
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
          )
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
          {place.isProject ? "Ver proyecto" : "Ver más"}
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
    // 68 px arriba, no los 20 de antes: el header fijo mide 56–60 y el popup
    // —ahora con portada— es más alto, así que con el margen viejo su cabecera
    // se metía debajo del header y la tarjeta se veía a medias. El margen la
    // deja entera dentro de la zona visible.
    autoPanPadding: [16, 68] as [number, number],
    // La hoja de recomendaciones recogida sigue tapando los últimos 120 px del
    // mapa. Sin este margen Leaflet daba por bueno un popup pegado al borde
    // inferior y el pin —que cuelga justo debajo de él— quedaba detrás de la
    // hoja, que es justo lo que se acaba de pedir que no pase.
    autoPanPaddingBottomRight: [16, 150] as [number, number],
  };
}
