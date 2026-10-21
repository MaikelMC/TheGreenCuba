"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/**
 * Lugares reales de la base, servidos en la landing.
 *
 * Resuelve dos problemas a la vez: el ancla «#lugares» del menú y del pie
 * apuntaba a una sección que no existía —el clic no llevaba a ninguna parte—,
 * y la landing no enlazaba a ni una sola ficha pública, de modo que un
 * buscador no podía llegar del home a los lugares caminando enlaces internos.
 *
 * Las fichas llegan del servidor y viajan en el HTML inicial, antes de que
 * exista JavaScript; lo que ocurre aquí en el cliente es el filtro por
 * provincia y el movimiento del carril. Si la base no contesta, la sección
 * desaparece y la página sigue —mismo criterio de resiliencia que el sitemap—.
 */

/** Lo mínimo que la tarjeta enseña. La landing no necesita más. */
export interface PlaceStripPlace {
  id: string;
  name: string;
  category: string;
  barrio: string;
  rating?: number;
  province: string;
  /** Logo del negocio. Sin él, el icono de ubicación de siempre. */
  logoUrl?: string;
}

/**
 * Una ficha del carril.
 *
 * La segunda vuelta del bucle es decorativa —existe solo para que el
 * desplazamiento no deje un hueco—, así que va marcada como copia: fuera del
 * árbol de accesibilidad y fuera del orden de tabulación. Sin el `tabIndex`,
 * el teclado pasaría por los mismos doce enlaces dos veces seguidas.
 */
function PlaceCard({
  place,
  clone,
}: {
  place: PlaceStripPlace;
  clone: boolean;
}) {
  return (
    <Link
      href={`/place/${place.id}`}
      tabIndex={clone ? -1 : undefined}
      className="group flex w-[280px] shrink-0 transform flex-col gap-4 rounded-3xl border border-ink/10 bg-white p-4 shadow-soft transition duration-300 ease-outquint hover:scale-[1.02] hover:border-verde-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400 focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-3">
        {/* La marca del negocio si la subió, y si no el icono de ubicación. La
            casilla lleva `overflow-hidden` para que la imagen no se salga de las
            esquinas redondeadas. */}
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-verde-50 text-verde-600">
          {place.logoUrl ? (
            <Image
              src={place.logoUrl}
              alt=""
              fill
              sizes="36px"
              className="object-cover"
            />
          ) : (
            <MapPin size={17} strokeWidth={1.8} aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-lv-display text-base font-semibold tracking-[-0.01em] text-ink group-hover:text-verde-700">
            {place.name}
          </h3>
          <p className="flex items-center gap-2 text-sm text-ink-soft/75">
            <span className="truncate">{place.category}</span>
            {place.barrio ? (
              <>
                <span className="mx-1 shrink-0">·</span>
                <span className="truncate">{place.barrio}</span>
              </>
            ) : null}
          </p>
          {place.rating ? (
            <div className="mt-1 flex items-center gap-1 text-sm font-semibold text-verde-600">
              <Star size={14} fill="currentColor" aria-hidden />
              <span>
                {place.rating.toLocaleString("es-CU", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-2 text-sm text-ink-soft/75">
        <span className="font-medium text-verde-600">{place.province}</span>
      </div>
    </Link>
  );
}

export function PlaceStrip({ places }: { places: PlaceStripPlace[] }) {
  // El hook va antes de cualquier salida temprana: si el número de hooks
  // cambia entre renders, React aborta el árbol entero.
  const [selectedProvince, setSelectedProvince] = React.useState<string | null>(
    null,
  );

  /* El filtro vive en la URL: se puede compartir y sobrevive al refresco. Se
     lee después de montar para no romper la hidratación, y se escribe con
     `replaceState` para no recargar ni perder la posición de la página. */
  React.useEffect(() => {
    const province = new URLSearchParams(window.location.search).get(
      "provincia",
    );
    if (province) setSelectedProvince(province);
  }, []);

  function selectProvince(province: string | null) {
    setSelectedProvince(province);
    const url = new URL(window.location.href);
    if (province) url.searchParams.set("provincia", province);
    else url.searchParams.delete("provincia");
    window.history.replaceState(null, "", url);
  }

  if (places.length === 0) return null;

  // Get unique provinces for the filter pills
  const provincesArray = places.map((p) => p.province);
  const provinces = Array.from(new Set(provincesArray.filter(Boolean)));

  // Filter places by selected province
  const filteredPlaces = selectedProvince
    ? places.filter((p) => p.province === selectedProvince)
    : places;

  /* Una vuelta del carril tiene que ser más ancha que la ventana o el bucle
     deja un hueco en blanco al llegar al final. Con doce fichas lo es de
     sobra; al filtrar por una provincia pueden quedar dos o tres, así que la
     lista se repite hasta ocho. Las dos vueltas son idénticas —eso es lo que
     hace que el -50% no tenga costura—, así que el patrón repetido no rompe
     nada. */
  const reel =
    filteredPlaces.length >= 8
      ? filteredPlaces
      : Array.from({ length: 8 })
          .flatMap(() => filteredPlaces)
          .slice(0, 8);

  return (
    <section
      id="lugares"
      className="scroll-mt-20 border-t border-ink/10 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-container px-gutter md:px-gutter-lg">
        <div className="mx-auto mb-gap-2xl max-w-[46ch] text-center">
          <p className="lv-mono text-[11px] uppercase tracking-[0.2em] text-verde-700">
            02 / 04 · Lugares
          </p>
          <Reveal
            as="h2"
            text="Fichas completas por provincia."
            accent="provincia"
            className="mt-4 font-lv-display text-[clamp(30px,4.5vw,48px)] font-bold leading-[1.05] tracking-[-0.035em] text-ink text-balance"
          />
          <Reveal
            as="p"
            text="Dirección, horarios, precios y las monedas que acepta cada uno. Toca uno y lo ves tal como lo ve quien lo busca."
            delay={120}
            className="mt-4 text-base leading-relaxed text-ink-soft/75 text-pretty"
          />

          {/* Filtro por provincia: vive en la URL y sobrevive al refresco. */}
          <div className="mx-auto mt-6 flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => selectProvince(null)}
              aria-pressed={selectedProvince === null}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 font-lv-display text-sm font-medium transition duration-300",
                selectedProvince === null
                  ? "bg-ink text-white"
                  : "border border-ink/15 bg-white text-ink hover:border-ink/30",
              )}
            >
              Todas las provincias
            </button>
            {provinces.map((province) => (
              <button
                key={province}
                type="button"
                onClick={() => selectProvince(province)}
                aria-pressed={selectedProvince === province}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 font-lv-display text-sm font-medium transition duration-300",
                  selectedProvince === province
                    ? "bg-ink text-white"
                    : "border border-ink/15 bg-white text-ink hover:border-ink/30",
                )}
              >
                {province}
              </button>
            ))}
          </div>

          {/* Debug info - remove in production */}
          {/* <div className="mt-2 text-xs text-ink-soft/50">
            Provinces found: {provinces.length} ({provinces.join(", ")})
          </div> */}
        </div>

        {/* Carril continuo. La lista va dos veces y `animate-marquee` desplaza
            -50%, que es exactamente una copia: el bucle no tiene costura. Se
            pausa al pasar el ratón, que si no la ficha se escapa del clic.

            Cada copia lleva su propio `gap` y `pr` para que el hueco entre la
            última ficha y la primera de la vuelta sea el mismo que entre
            fichas; con el gap en el contenedor ese hueco queda a la mitad. */}
        <div className="mt-8 overflow-hidden rounded-3xl border border-ink/10 bg-white/50 py-4">
          {filteredPlaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-body text-ink-soft/75">
                No hay negocios disponibles en{" "}
                {selectedProvince || "todas las provincias"}.
              </p>
            </div>
          ) : (
            <div
              id="places-track"
              className="flex w-max animate-marquee hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-reduce:animate-none [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]"
            >
              {[0, 1].map((copy) => (
                <div
                  key={copy}
                  className="flex shrink-0 gap-4 pr-4"
                  aria-hidden={copy === 1 ? true : undefined}
                >
                  {reel.map((place, i) => (
                    <PlaceCard
                      key={`${copy}-${i}`}
                      place={place}
                      clone={copy === 1}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
