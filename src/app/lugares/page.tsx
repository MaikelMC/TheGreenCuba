import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MapPin, Search, Star } from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SelloVerificado } from "@/components/place/sello-verificado";
import { TopDelMes } from "@/components/place/top-del-mes";
import { siteConfig } from "@/config/site";
import { listCategories, listPlaces } from "@/lib/db/queries";
import type { UserPlace } from "@/lib/places-store";
import { categoryEmoji, FILLER_PLACE_IDS } from "@/lib/places";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  categoryPath,
  cityPath,
  placeUrl,
} from "@/lib/structured-data";
import { cn, slugify } from "@/lib/utils";

/**
 * El directorio público de negocios.
 *
 * Existe por dos motivos, y el segundo es el que no se ve:
 *
 * 1. Es la puerta de entrada completa al catálogo. La portada solo enseña doce
 *    fichas; aquí están todas, con buscador y filtros.
 * 2. Es la página que enlaza a **cada** ficha desde un HTML rastreable. Google
 *    necesita un camino de enlaces internos para descubrir y valorar las
 *    fichas; el sitemap ayuda, pero un enlace contextual desde un directorio
 *    con el nombre y la descripción del negocio pesa más.
 *
 * La búsqueda y los filtros se resuelven en el servidor con un formulario GET.
 * No hay JavaScript de cliente: la URL lleva el estado (?q=&provincia=&categoria=)
 * y se puede compartir. También significa que cada combinación se renderiza
 * igual para todos y el HTML llega completo al buscador.
 *
 * Los filtros se aplican en memoria sobre la lista cacheada del catálogo. Hoy
 * son decenas de negocios; si algún día pasan de varios cientos, esto se mueve
 * a `WHERE` en `listPlaces`.
 */

const TITLE = "Directorio de negocios y lugares en Cuba";
const DESCRIPTION =
  "Todos los negocios de La Verde: restaurantes, cafeterías, bares, tiendas, hospedajes y más. Busca por nombre o filtra por provincia y categoría.";

/**
 * Con filtros o búsqueda, la página es un resultado, no el directorio: se
 * canoniza a `/lugares` y se marca `noindex` para que no compita con él ni llene
 * el índice de combinaciones de `?q=`. Sin filtros sigue siendo la página que se
 * indexa.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const hasFilters = Boolean(
    one(params.q) || one(params.provincia) || one(params.categoria),
  );

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/lugares" },
    robots: hasFilters ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      title: TITLE,
      description: DESCRIPTION,
      url: `${siteConfig.url.replace(/\/$/, "")}/lugares`,
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

type SearchParams = {
  q?: string | string[];
  provincia?: string | string[];
  categoria?: string | string[];
};

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Sin tildes y en minúsculas, para que «cafeteria» encuentre «Cafetería». */
function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

function matches(place: UserPlace, query: string): boolean {
  if (!query) return true;
  const haystack = normalize(
    [
      place.name,
      place.category,
      place.barrio,
      place.city ?? "",
      place.province ?? "",
      place.description,
    ].join(" "),
  );
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function PlaceDirectoryCard({ place }: { place: UserPlace }) {
  const cover = place.photos?.[0]?.url ?? null;
  const logo = place.logoUrl ?? null;
  const image = cover ?? logo;
  const closed = place.status !== "active";

  return (
    <Link
      href={`/place/${place.id}`}
      className="group flex flex-row overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-soft transition duration-300 ease-outquint hover:-translate-y-[2px] hover:border-verde-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-500 focus-visible:ring-offset-2 sm:flex-col sm:rounded-3xl"
    >
      {/* En móvil la tarjeta va en horizontal: una miniatura de 112 px y el
          texto al lado. La versión vertical —imagen 4:3 a todo el ancho— dejaba
          una tarjeta de media pantalla y el contenido apretado en el hueco que
          sobraba. Desde `sm` vuelve a la rejilla de siempre. */}
      <div className="relative aspect-square w-[112px] shrink-0 overflow-hidden bg-verde-50 sm:aspect-[4/3] sm:w-full">
        {image ? (
          <Image
            src={image}
            alt={cover ? `Foto de ${place.name}` : `Logo de ${place.name}`}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 112px"
            quality={70}
            className={cn(
              "transition duration-500 ease-outquint group-hover:scale-[1.03]",
              cover ? "object-cover" : "object-contain p-4 sm:p-10",
            )}
          />
        ) : (
          <span
            aria-hidden
            className="grid size-full place-items-center text-[32px] sm:text-[56px]"
          >
            {categoryEmoji(place.category)}
          </span>
        )}

        {/* A 112 px de ancho las pastillas no caben sin partirse. En móvil el
            dato sigue en la ficha; aquí solo estorbaría. */}
        <div className="absolute left-3 top-3 hidden flex-wrap gap-1 sm:flex">
          {place.selloVerificado && <SelloVerificado />}
          {place.topDelMes && <TopDelMes />}
          {closed && (
            <span className="inline-flex items-center gap-[5px] rounded-full border border-ink/10 bg-white/95 px-[10px] py-[3px] font-lv-display text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
              Cerrado
            </span>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center p-gap-sm sm:justify-start sm:p-gap-md">
        <div className="flex items-start justify-between gap-gap-xs sm:gap-gap-sm">
          <h2 className="font-lv-display text-base font-bold leading-snug tracking-[-0.01em] text-ink group-hover:text-verde-700 sm:text-h3 sm:leading-tight">
            {place.name}
          </h2>
          {place.rating ? (
            <span className="inline-flex shrink-0 items-center gap-[3px] font-lv-display text-small font-semibold text-verde-600">
              <Star size={13} fill="currentColor" aria-hidden />
              {place.rating.toLocaleString("es-CU", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </span>
          ) : null}
        </div>

        <p className="mt-1 text-small text-ink-soft/75">
          {[place.category, place.barrio].filter(Boolean).join(" · ")}
        </p>

        {place.description && (
          <p className="mt-gap-xs line-clamp-3 hidden text-small leading-relaxed text-ink-soft/75 sm:block">
            {place.description}
          </p>
        )}

        <div className="mt-gap-xs flex flex-wrap items-center gap-x-gap-sm gap-y-gap-xs text-meta text-ink-soft/75 sm:mt-auto sm:pt-gap-sm">
          <span className="inline-flex items-center gap-[4px]">
            <MapPin size={13} strokeWidth={1.8} aria-hidden />
            {[place.province, place.city].filter(Boolean).filter(
              (value, index, list) => list.indexOf(value) === index,
            ).join(" · ")}
          </span>
          {place.priceLabel && (
            <span className="font-lv-display font-semibold text-verde-700">
              {place.priceLabel}
            </span>
          )}
          {/* La tarjeta entera es el enlace; en móvil el rótulo no cabe y no
              hace falta. */}
          <span className="ml-auto hidden items-center gap-[3px] font-lv-display font-semibold text-verde-700 sm:inline-flex">
            Ver ficha
            <ArrowUpRight size={13} strokeWidth={2} aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function DirectorioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = one(params.q);
  const provincia = one(params.provincia);
  const categoria = one(params.categoria);

  let places: UserPlace[] = [];
  let failed = false;
  try {
    const catalog = await listPlaces({ onlyActive: true, limit: 500 });
    /* Solo fichas aprobadas. `onlyActive` filtra lo apagado, pero una ficha
       pendiente que alguien haya dejado publicada a mano no debe aparecer en el
       directorio público. */
    places = catalog.filter(
      (place) =>
        place.reviewStatus === "approved" && !FILLER_PLACE_IDS.has(place.id),
    );
  } catch {
    failed = true;
  }

  const provinces = unique(places.map((place) => place.province ?? ""));
  const categories = unique(places.map((place) => place.category));

  const filtered = places.filter(
    (place) =>
      matches(place, query) &&
      (!provincia || normalize(place.province ?? "") === normalize(provincia)) &&
      (!categoria || normalize(place.category) === normalize(categoria)),
  );

  const hasFilters = Boolean(query || provincia || categoria);

  const breadcrumbsJsonLd = breadcrumbJsonLd([
    { name: "Inicio", url: absoluteUrl("/") },
    { name: "Directorio", url: absoluteUrl("/lugares") },
  ]);

  /* Las categorías del catálogo llevan su `slug` real: «Vida nocturna» es
     `discoteca` en la base y `slugify` daría una URL que no existe. */
  let categorySlugByName = new Map<string, string>();
  try {
    categorySlugByName = new Map(
      (await listCategories()).map((category) => [category.label, category.value]),
    );
  } catch {
    /* Sin slugs se enseña el directorio sin chips; el listado sigue. */
  }
  const categoryLinks = categories
    .map((name) => ({ name, slug: categorySlugByName.get(name) }))
    .filter((item): item is { name: string; slug: string } => Boolean(item.slug));
  const cityLinks = unique(places.map((place) => place.city ?? ""))
    .map((city) => ({ name: city, slug: slugify(city) }))
    .filter((city) => city.slug);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: TITLE,
    numberOfItems: filtered.length,
    itemListElement: filtered.slice(0, 100).map((place, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: placeUrl(place.id),
      name: place.name,
    })),
  };

  return (
    <div className="lv-dot-grid flex min-h-screen min-h-dvh flex-col font-lv-display text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbsJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <a href="#content" className="skip-link">
        Saltar al contenido
      </a>

      <header className="border-b border-ink/10">
        <div className="mx-auto flex h-[68px] max-w-container items-center justify-between gap-gap-sm px-gutter md:px-gutter-lg">
          <Link
            href="/"
            className="flex items-center gap-2 font-lv-display text-[20px] font-bold tracking-[-0.02em] text-ink"
          >
            <Logo className="h-[26px] w-auto shrink-0" />
            <span translate="no">La Verde</span>
          </Link>

          <div className="flex items-center gap-gap-xs">
            <ThemeToggle className="size-10 border-ink/10 bg-white text-ink shadow-none hover:bg-verde-50" />
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-[16px] font-lv-display text-small font-semibold text-ink transition-colors duration-300 hover:border-ink/30 hover:bg-white"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>

      <main id="content" className="flex-1">
        <section className="mx-auto max-w-container px-gutter pb-gap-2xl pt-12 md:px-gutter-lg sm:pt-16">
          <p className="lv-mono text-[11px] uppercase tracking-[0.2em] text-verde-700">
            Directorio
          </p>
          <h1 className="mt-3 max-w-[18ch] font-lv-display text-[clamp(34px,6vw,60px)] font-bold leading-[1.02] tracking-[-0.035em] text-ink text-balance">
            Todos los negocios de Cuba, en un solo lugar.
          </h1>
          <p className="mt-4 max-w-[58ch] text-lead leading-relaxed text-ink-soft/75 text-pretty">
            Busca por nombre, barrio o categoría.
          </p>

          {/* GET nativo: sin JavaScript, el estado vive en la URL y cada
              combinación de filtros se puede compartir y rastrear. */}
          <form
            action="/lugares"
            method="get"
            className="mt-gap-xl grid gap-gap-sm rounded-3xl border border-ink/10 bg-white p-gap-md shadow-soft sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
          >
            <div className="relative">
              <label htmlFor="q" className="sr-only">
                Buscar negocios
              </label>
              <Search
                size={18}
                strokeWidth={1.8}
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft/50"
              />
              <input
                id="q"
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Nombre, barrio o categoría"
                className="h-12 w-full rounded-full border border-ink/15 bg-white pl-11 pr-4 text-body text-ink placeholder:text-ink-soft/50 focus-visible:border-verde-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-500/40"
              />
            </div>

            <div>
              <label htmlFor="provincia" className="sr-only">
                Provincia
              </label>
              <select
                id="provincia"
                name="provincia"
                defaultValue={provincia}
                className="h-12 w-full rounded-full border border-ink/15 bg-white px-4 text-small font-medium text-ink focus-visible:border-verde-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-500/40 sm:w-auto"
              >
                <option value="">Todas las provincias</option>
                {provinces.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="categoria" className="sr-only">
                Categoría
              </label>
              <select
                id="categoria"
                name="categoria"
                defaultValue={categoria}
                className="h-12 w-full rounded-full border border-ink/15 bg-white px-4 text-small font-medium text-ink focus-visible:border-verde-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-500/40 sm:w-auto"
              >
                <option value="">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="h-12 rounded-full bg-ink px-6 font-lv-display text-small font-semibold text-white transition-colors duration-300 hover:bg-verde-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-500 focus-visible:ring-offset-2"
            >
              Buscar
            </button>
          </form>

          <div className="mt-gap-lg flex flex-wrap items-center justify-between gap-gap-sm">
            <p className="text-small text-ink-soft/75">
              {failed
                ? "No se pudo cargar el directorio ahora mismo."
                : `${filtered.length} ${
                    filtered.length === 1 ? "negocio" : "negocios"
                  }${hasFilters ? " con estos filtros" : " publicados"}`}
            </p>
            {hasFilters && (
              <Link
                href="/lugares"
                className="font-lv-display text-small font-semibold text-verde-700 underline-offset-4 hover:underline"
              >
                Limpiar filtros
              </Link>
            )}
          </div>

          {/* Los hubs de categoría y ciudad. Son enlaces rastreables, no filtros
              de formulario: Google necesita un camino a las páginas que compiten
              por «cafeterías en Santiago de Cuba», no una URL con parámetros que
              se canoniza al directorio. */}
          {!hasFilters && (categoryLinks.length > 0 || cityLinks.length > 0) && (
            <nav
              aria-label="Explorar por categoría y ciudad"
              className="mt-gap-lg flex flex-col gap-gap-sm"
            >
              {categoryLinks.length > 0 && (
                <div className="flex flex-wrap items-center gap-gap-xs">
                  <span className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-ink-soft/60">
                    Categorías
                  </span>
                  {categoryLinks.map((category) => (
                    <Link
                      key={category.slug}
                      href={categoryPath(category.slug)}
                      className="inline-flex h-9 items-center rounded-full border border-ink/10 bg-white px-4 font-lv-display text-small font-semibold text-ink transition-colors hover:border-verde-300 hover:bg-verde-50"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              )}
              {cityLinks.length > 0 && (
                <div className="flex flex-wrap items-center gap-gap-xs">
                  <span className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-ink-soft/60">
                    Ciudades
                  </span>
                  {cityLinks.map((city) => (
                    <Link
                      key={city.slug}
                      href={cityPath(city.slug)}
                      className="inline-flex h-9 items-center rounded-full border border-ink/10 bg-white px-4 font-lv-display text-small font-semibold text-ink transition-colors hover:border-verde-300 hover:bg-verde-50"
                    >
                      {city.name}
                    </Link>
                  ))}
                </div>
              )}
            </nav>
          )}

          {filtered.length > 0 ? (
            <div className="mt-gap-md grid gap-gap-sm sm:grid-cols-2 sm:gap-gap-md lg:grid-cols-3">
              {filtered.map((place) => (
                <PlaceDirectoryCard key={place.id} place={place} />
              ))}
            </div>
          ) : (
            <div className="mt-gap-md rounded-3xl border border-ink/10 bg-white p-gap-xl text-center shadow-soft">
              <p className="font-lv-display text-h3 font-semibold text-ink">
                No encontramos negocios con esos filtros.
              </p>
              <p className="mt-2 text-small text-ink-soft/75">
                Prueba con otra provincia, otra categoría o una palabra más
                corta.
              </p>
              <Link
                href="/lugares"
                className="mt-gap-md inline-flex h-11 items-center justify-center rounded-full bg-ink px-6 font-lv-display text-small font-semibold text-white transition-colors hover:bg-verde-800"
              >
                Ver todo el directorio
              </Link>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
