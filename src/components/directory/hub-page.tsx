import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { Logo } from "@/components/layout/logo";
import type { UserPlace } from "@/lib/places-store";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  placeUrl,
} from "@/lib/structured-data";
import { PlaceLinkList } from "./place-link-list";

type Crumb = { name: string; href: string };
type HubLink = { name: string; href: string };

/**
 * La carcasa común de los hubs de categoría y ciudad.
 *
 * Todo se pinta en el servidor: el titular, la introducción, los enlaces a otros
 * hubs y la lista de fichas viajan en el HTML crudo. No hay `useEffect` ni
 * catálogo en el navegador, que es lo que hace que estas páginas sean rastreables
 * y ligeras a la vez.
 */
export function HubPage({
  title,
  intro,
  eyebrow,
  crumbs,
  links,
  linksLabel,
  places,
}: {
  title: string;
  intro: string;
  eyebrow: string;
  crumbs: Crumb[];
  links?: HubLink[];
  linksLabel?: string;
  places: UserPlace[];
}) {
  const breadcrumbs = breadcrumbJsonLd(
    crumbs.map((crumb) => ({
      name: crumb.name,
      url: absoluteUrl(crumb.href),
    })),
  );
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    numberOfItems: places.length,
    itemListElement: places.slice(0, 100).map((place, index) => ({
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
          __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemList).replace(/</g, "\\u003c"),
        }}
      />

      <header className="border-b border-ink/10">
        <div className="mx-auto flex h-[68px] max-w-container items-center justify-between gap-gap-sm px-gutter md:px-gutter-lg">
          <Link
            href="/"
            className="flex items-center gap-2 font-lv-display text-[20px] font-bold tracking-[-0.02em] text-ink"
          >
            <Logo className="h-[26px] w-auto shrink-0" />
            <span translate="no">La Verde</span>
          </Link>
          <Link
            href="/lugares"
            className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-[16px] font-lv-display text-small font-semibold text-ink transition-colors duration-300 hover:border-ink/30 hover:bg-white"
          >
            Todo el directorio
          </Link>
        </div>
      </header>

      <main id="content" className="flex-1">
        <div className="mx-auto max-w-container px-gutter pb-gap-2xl pt-10 md:px-gutter-lg sm:pt-14">
          <nav
            aria-label="Miga de pan"
            className="flex flex-wrap items-center gap-2 text-meta text-ink-soft/70"
          >
            {crumbs.map((crumb, index) => (
              <span key={crumb.href} className="inline-flex items-center gap-2">
                {index > 0 && <span aria-hidden>/</span>}
                {index === crumbs.length - 1 ? (
                  <span aria-current="page">{crumb.name}</span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="transition-colors hover:text-verde-700"
                  >
                    {crumb.name}
                  </Link>
                )}
              </span>
            ))}
          </nav>

          <p className="lv-mono mt-gap-lg text-[11px] uppercase tracking-[0.2em] text-verde-700">
            {eyebrow}
          </p>
          <h1 className="mt-3 max-w-[20ch] font-lv-display text-[clamp(32px,5vw,54px)] font-bold leading-[1.04] tracking-[-0.03em] text-ink text-balance">
            {title}
          </h1>
          <p className="mt-4 max-w-[62ch] text-lead leading-relaxed text-ink-soft/75 text-pretty">
            {intro}
          </p>

          {links && links.length > 0 && (
            <nav
              aria-label={linksLabel ?? "Explorar"}
              className="mt-gap-lg flex flex-wrap items-center gap-gap-xs"
            >
              {linksLabel && (
                <span className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-ink-soft/60">
                  {linksLabel}
                </span>
              )}
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-ink/10 bg-white px-4 font-lv-display text-small font-semibold text-ink transition-colors hover:border-verde-300 hover:bg-verde-50"
                >
                  {link.name}
                  <ArrowUpRight size={12} strokeWidth={2} aria-hidden />
                </Link>
              ))}
            </nav>
          )}

          <PlaceLinkList places={places} />

          <p className="mt-gap-xl text-small text-ink-soft/75">
            ¿Tienes un negocio en Cuba?{" "}
            <Link
              href="/register"
              className="font-semibold text-verde-700 underline-offset-4 hover:underline"
            >
              Publícalo en La Verde
            </Link>
            .
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
