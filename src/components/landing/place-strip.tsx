import Link from "next/link";
import { MapPin, Star } from "lucide-react";

/**
 * Lugares reales de la base, servidos en la landing.
 *
 * Resuelve dos problemas a la vez: el ancla «#lugares» del menú y del pie
 * apuntaba a una sección que no existía —el clic no llevaba a ninguna parte—,
 * y la landing no enlazaba a ni una sola ficha pública, de modo que un
 * buscador no podía llegar del home a los lugares caminando enlaces internos.
 *
 * Es un componente de servidor sin animaciones a propósito: el contenido va en
 * el HTML inicial, visible sin JavaScript, que es exactamente lo que un
 * rastreador necesita. Si la base no contesta, la sección desaparece y la
 * página sigue —mismo criterio de resiliencia que el sitemap—.
 */

/** Lo mínimo que la tarjeta enseña. La landing no necesita más. */
export interface PlaceStripPlace {
  id: string;
  name: string;
  category: string;
  barrio: string;
  rating?: number;
}

export function PlaceStrip({ places }: { places: PlaceStripPlace[] }) {
  if (places.length === 0) return null;

  return (
    <section
      id="lugares"
      className="border-t border-ink/5 bg-sand py-24 sm:py-32 scroll-mt-20"
    >
      <div className="mx-auto max-w-container px-gutter md:px-gutter-lg">
        <div className="mx-auto mb-gap-3xl max-w-[46ch] text-center">
          <p className="landing-features-label inline-flex items-center rounded-full border border-verde-200 bg-verde-50 px-3.5 py-1.5 font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
            Lugares reales
          </p>
          <h2 className="mt-gap-sm font-lv-display text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink text-balance">
            Negocios de verdad, fichas completas
          </h2>
          <p className="mt-gap-sm text-body leading-relaxed text-ink-soft/75 text-pretty">
            Dirección, horarios, precios y las monedas que acepta cada uno. Toca
            uno y lo ves tal como lo ve quien lo busca.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-gap-sm sm:grid-cols-2 lg:grid-cols-4">
          {places.map((place) => (
            <li key={place.id}>
              <Link
                href={`/place/${place.id}`}
                className="group flex h-full flex-col gap-gap-xs rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft transition-all duration-500 ease-outquint hover:border-verde-300 hover:shadow-card"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-verde-50 text-verde-600">
                  <MapPin size={17} strokeWidth={1.8} />
                </span>
                <span className="font-lv-display text-body font-semibold tracking-[-0.01em] text-ink group-hover:text-verde-700">
                  {place.name}
                </span>
                <span className="text-meta text-ink-soft/75">
                  {place.category}
                  {place.barrio ? ` · ${place.barrio}` : ""}
                </span>
                {place.rating ? (
                  <span className="inline-flex items-center gap-[4px] font-lv-display text-meta font-semibold text-verde-600">
                    <Star size={13} fill="currentColor" />
                    {place.rating.toFixed(1)}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
