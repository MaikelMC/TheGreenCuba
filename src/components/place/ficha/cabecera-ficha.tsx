import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { placeIcon } from "@/lib/places";
import { COPY, MIN_RESENAS_PARA_NOTA } from "@/config/ficha";
import type { PlaceData } from "@/lib/ficha/place-data";
import { cn } from "@/lib/utils";
import { Monograma } from "./monograma";

/**
 * La cabecera: marca, nombre, subtítulo y valoración.
 *
 * La valoración solo se enseña cuando hay suficientes reseñas para que la media
 * signifique algo. Por debajo del mínimo se dice cuántas hay, sin nota: un 5,0
 * de una sola persona presentado como la nota del negocio es una afirmación que
 * el dato no sostiene.
 */
export function CabeceraFicha({
  place,
  className,
}: {
  place: PlaceData;
  className?: string;
}) {
  const Icono = resolveCategoryIcon(placeIcon(place.icon, place.category));
  const stats = place.reviewsStats;
  const tieneNota = Boolean(stats && stats.total >= MIN_RESENAS_PARA_NOTA);

  return (
    <div className={cn("flex items-start gap-gap-md", className)}>
      <span className="relative block size-20 shrink-0 overflow-hidden rounded-full border border-ink/5 bg-white lg:size-24">
        {place.logoUrl ? (
          <Image
            src={place.logoUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 96px, 80px"
            className="object-cover"
          />
        ) : (
          <Monograma
            nombre={place.name}
            colorMarca={place.colorMarca}
            className="size-full text-h3 lg:text-h2"
          />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-balance font-lv-display text-h2 font-bold leading-[1.08] tracking-[-0.02em] text-ink">
          {place.name}
        </p>

        {place.shortDescription && (
          <p className="mt-gap-xs max-w-[60ch] text-pretty text-body leading-relaxed text-ink-soft/80">
            {place.shortDescription}
          </p>
        )}

        <div className="mt-gap-sm flex flex-wrap items-center gap-x-gap-sm gap-y-gap-xs">
          <span className="inline-flex items-center gap-[4px] rounded-full border border-verde-200 bg-verde-50 px-[10px] py-[3px] font-lv-display text-xs font-semibold uppercase tracking-[0.06em] text-verde-700">
            <Icono size={12} strokeWidth={1.8} />
            {place.category}
          </span>

          <span className="inline-flex items-center gap-[4px] font-lv-display text-meta font-medium text-ink-soft/75">
            <MapPin size={13} strokeWidth={1.8} className="text-verde-600" />
            {place.barrio}
          </span>

          {tieneNota && stats ? (
            <span
              className="inline-flex items-center gap-[5px] font-lv-display text-meta font-semibold text-ink"
              aria-label={`${stats.promedio.toFixed(1)} de 5 con ${stats.total} reseñas`}
            >
              <Star
                size={14}
                strokeWidth={1.8}
                fill="currentColor"
                className="text-verde-500"
              />
              {stats.promedio.toFixed(1)}
              <span className="font-normal text-ink-soft/60">
                ({stats.total} {stats.total === 1 ? COPY.resena : COPY.resenas})
              </span>
            </span>
          ) : stats && stats.total > 0 ? (
            <span className="font-lv-display text-meta text-ink-soft/60">
              {stats.total} {stats.total === 1 ? COPY.resena : COPY.resenas}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
