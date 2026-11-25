"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { haversineM } from "@/lib/map/routing";
import { cn } from "@/lib/utils";
import type { MapPlace } from "./types";

/**
 * Alternativa cuando el dispositivo no puede crear WebGL.
 *
 * No intenta pintar teselas ni carga una librería nueva: ordena los negocios
 * que el catálogo ya tiene, con búsqueda y categoría, y enlaza a su ficha.
 */
export function MapaSinWebgl({
  places,
  center,
}: {
  places: MapPlace[];
  center: [number, number];
}) {
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState("todas");

  const categorias = useMemo(
    () => [...new Set(places.map((p) => p.category).filter(Boolean))].sort(),
    [places],
  );

  const lista = useMemo(() => {
    const consulta = texto.trim().toLowerCase();
    return places
      .filter((p) => {
        if (categoria !== "todas" && p.category !== categoria) return false;
        if (!consulta) return true;
        return `${p.name} ${p.category} ${p.barrio ?? ""}`
          .toLowerCase()
          .includes(consulta);
      })
      .map((p) => ({
        place: p,
        distancia: haversineM(
          { lat: center[0], lng: center[1] },
          { lat: p.lat, lng: p.lng },
        ),
      }))
      .sort((a, b) => a.distancia - b.distancia);
  }, [places, texto, categoria, center]);

  return (
    <div className="absolute inset-0 overflow-y-auto bg-sand">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-gap-sm px-gutter py-gap-md">
        <header className="rounded-2xl border border-ink/5 bg-white p-gap-md">
          <h2 className="font-lv-display text-body font-semibold text-ink">
            Tu teléfono no puede mostrar el mapa
          </h2>
          <p className="mt-gap-xs text-small text-ink-soft/75">
            Aquí tienes los negocios cercanos, ordenados por distancia. La ficha
            y los filtros funcionan igual.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-gap-sm sm:grid-cols-[1fr_auto]">
          <label className="relative block">
            <span className="sr-only">Buscar negocio</span>
            <Search
              size={17}
              strokeWidth={1.8}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/60"
            />
            <input
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder="Buscar por nombre o barrio"
              className="h-11 w-full rounded-xl border border-ink/10 bg-white pl-10 pr-3 text-small text-ink outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20"
            />
          </label>
          <label>
            <span className="sr-only">Categoría</span>
            <select
              value={categoria}
              onChange={(evento) => setCategoria(evento.target.value)}
              className="h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-small text-ink outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20 sm:w-auto"
            >
              <option value="todas">Todas las categorías</option>
              {categorias.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        {lista.length === 0 ? (
          <p className="rounded-2xl border border-ink/5 bg-white p-gap-md text-small text-ink-soft/75">
            No hay negocios que coincidan con ese filtro.
          </p>
        ) : (
          <ul className="flex flex-col gap-gap-xs">
            {lista.slice(0, 80).map(({ place, distancia }) => (
              <li key={place.id}>
                <Link
                  href={`/place/${place.id}`}
                  className="flex min-h-11 items-center gap-gap-sm rounded-2xl border border-ink/5 bg-white p-gap-sm transition-colors hover:border-verde-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-verde-50 text-verde-700">
                    <MapPin size={18} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-lv-display text-small font-semibold text-ink">
                      {place.name}
                    </span>
                    <span className="block truncate text-meta text-ink-soft/75">
                      {place.category}
                      {place.barrio ? ` · ${place.barrio}` : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-meta font-semibold text-ink-soft/70",
                      distancia < 2000 && "text-verde-700",
                    )}
                  >
                    {distancia < 1000
                      ? `${Math.round(distancia)} m`
                      : `${(distancia / 1000).toFixed(1)} km`}
                  </span>
                  <ArrowRight
                    size={16}
                    strokeWidth={1.8}
                    aria-hidden
                    className="shrink-0 text-ink-soft/50"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
