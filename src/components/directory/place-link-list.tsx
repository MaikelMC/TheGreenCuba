import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import type { UserPlace } from "@/lib/places-store";
import { categoryEmoji } from "@/lib/places";

/**
 * Listado de fichas para los hubs de categoría y ciudad.
 *
 * Texto y enlace, sin foto: estas páginas existen para que el HTML lleve el
 * nombre, la categoría y la ubicación de cada negocio a un buscador, y para que
 * alguien con datos móviles llegue a la ficha sin descargar una rejilla de
 * portadas. La ficha es la que enseña las fotos.
 */
export function PlaceLinkList({ places }: { places: UserPlace[] }) {
  return (
    <ul className="mt-gap-lg grid gap-gap-sm sm:grid-cols-2">
      {places.map((place) => {
        const location = [place.city, place.province]
          .filter(Boolean)
          .filter((value, index, list) => list.indexOf(value) === index)
          .join(" · ");

        return (
          <li key={place.id}>
            <Link
              href={`/place/${place.id}`}
              className="group flex h-full gap-gap-sm rounded-2xl border border-ink/10 bg-white p-gap-md shadow-soft transition duration-300 ease-outquint hover:-translate-y-[2px] hover:border-verde-300 hover:shadow-card"
            >
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-full bg-verde-50 text-[20px]"
              >
                {categoryEmoji(place.category)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-gap-xs">
                  <span className="font-lv-display text-body font-bold leading-snug text-ink group-hover:text-verde-700">
                    {place.name}
                  </span>
                  <ArrowUpRight
                    size={14}
                    strokeWidth={2}
                    aria-hidden
                    className="mt-1 shrink-0 text-verde-700"
                  />
                </span>
                <span className="mt-1 block text-small text-ink-soft/75">
                  {[place.category, place.barrio].filter(Boolean).join(" · ")}
                </span>
                {location && (
                  <span className="mt-1 flex items-center gap-[4px] text-meta text-ink-soft/75">
                    <MapPin size={12} strokeWidth={1.8} aria-hidden />
                    {location}
                  </span>
                )}
                {place.description && (
                  <span className="mt-gap-xs line-clamp-2 block text-small leading-relaxed text-ink-soft/75">
                    {place.description}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
