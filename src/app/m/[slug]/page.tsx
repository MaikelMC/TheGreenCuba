import type { Metadata } from "next";
import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CreditCard, MessageCircle, Phone } from "lucide-react";
import { getPlaceBySlug } from "@/lib/db/queries";
import { DEV_PLACE_ID, devPlaceIndexable, mayViewDevPlace } from "@/lib/dev-place";
import { whatsappHref } from "@/lib/contact-links";
import { menuUrl } from "@/lib/structured-data";
import { categoryEmoji } from "@/lib/places";
import { cn, currencyLabel, formatMenuPrice, slugify } from "@/lib/utils";
import { estaAgotado, type Disponibilidad } from "@/lib/disponibilidad";

/**
 * El menú público: la URL corta y estable que se reparte.
 *
 * Es `/m/{slug}` y no `/place/{id}/carta`. El `slug` es único y no se recalcula
 * al renombrar, así que un QR impreso no se rompe; y el id sigue siendo válido
 * porque la ruta vieja redirige aquí con un 301 (ver
 * `place/[id]/carta/page.tsx`).
 *
 * **A propósito fuera de `(main)`.** Ese layout es un componente de cliente que
 * monta `PlacesProvider` —el catálogo entero, en el navegador—, `SearchProvider`,
 * `MotionConfig` y el `Header`: para una carta que se abre desde un QR y que la
 * mayoría de las veces se mira una sola vez, todo eso es peso muerto. Aquí solo
 * se hereda el layout raíz.
 *
 * **Sin `"use client"` y sin componentes de cliente.** La versión anterior
 * montaba `CartaMenu` (`useState`) y `MenuItem` (`motion/react`): con dos
 * platos ya había JavaScript que no hacía falta. Aquí la carta entera se
 * resuelve en el servidor y las categorías son anclas —enlaces del navegador, no
 * estado de React—.
 *
 * El tope `productos_max` no se aplica al pintar: es antiabuso y ya corta al
 * guardar (ver `PATCH /api/places/[id]`). El menú se enseña completo.
 *
 * `revalidate` deja que la página sea ISR; el contenido cacheado detrás
 * (`getPlaceBySlug`) se invalida con `revalidateTag(CATALOG_TAG)` en cuanto el
 * dueño guarda, así que editar el menú se ve sin esperar al TTL.
 */
export const revalidate = 300;

const getPlace = cache(async (slug: string) => {
  try {
    return await getPlaceBySlug(slug, { includeDev: slug === DEV_PLACE_ID });
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlace(slug);

  if (!place) {
    return { title: "Menú no encontrado", robots: { index: false, follow: true } };
  }

  const where = place.city || place.barrio || "Cuba";
  const count = place.menu.length;
  const title = `Menú de ${place.name} — ${place.category} en ${where}`;
  const description = count
    ? `${count} ${count === 1 ? "entrada" : "entradas"} con precios y fotos en el menú de ${place.name}.`
    : `${place.name}, ${place.category} en ${where}.`;
  const cover = place.logoUrl ?? place.photos?.[0]?.url;

  return {
    title,
    description,
    alternates: { canonical: `/m/${place.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: menuUrl(place.slug),
      images: cover ? [cover] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
    /* Solo se indexa un menú publicado y con algo dentro. El negocio de prueba
       nunca: fuera de desarrollo es una ficha privada a la que se llega por URL
       (ver `dev-place.ts`). */
    robots:
      place.isActive &&
      place.status === "active" &&
      count > 0 &&
      devPlaceIndexable(place.id)
        ? undefined
        : { index: false, follow: true },
  };
}

/** Una entrada del menú, resuelta en el servidor. Sin `motion` ni estado. */
function MenuRow({
  item,
}: {
  item: {
    name: string;
    description: string;
    price: string;
    currency: string;
    tag?: string;
    category?: string;
    image?: string;
    disponibilidad?: Disponibilidad;
    agotadoHasta?: number | null;
  };
}) {
  const priceText = formatMenuPrice(item.price, item.currency);
  /* Agotado no es «no está»: el producto sigue en la carta, apagado y con la
     etiqueta, para que quien lo buscaba sepa que hoy no hay sin creer que
     desapareció del menú. */
  const agotado = estaAgotado(item);

  return (
    <div
      className={cn(
        "flex gap-gap-md border-b border-ink/5 py-gap-md last:border-b-0",
        agotado && "opacity-60",
      )}
    >
      <div
        className={cn(
          "relative grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-2xl bg-sand-deep text-verde-600",
          agotado && "grayscale",
        )}
      >
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name ? `Foto de ${item.name}` : ""}
            fill
            sizes="72px"
            quality={70}
            className="object-cover"
          />
        ) : (
          <span className="text-[28px]">🍽️</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-[2px] flex flex-wrap items-center gap-gap-xs">
          <span className="font-lv-display text-small font-semibold text-ink">
            {item.name}
          </span>
          {agotado && (
            <span className="rounded-full bg-destructive/10 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-destructive">
              Agotado
            </span>
          )}
        </div>
        {item.description && (
          <div className="text-meta leading-snug text-ink-soft/75">
            {item.description}
          </div>
        )}
        {(priceText || item.tag) && (
          <div className="mt-[6px] flex items-center gap-gap-xs">
            {priceText && (
              <span className="font-lv-display text-small font-semibold text-ink">
                {priceText}
              </span>
            )}
            {item.tag && (
              <span className="ml-auto rounded-full bg-verde-100 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-verde-700">
                {item.tag}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default async function MenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = await getPlace(slug);
  if (!place) notFound();

  const brand = place.logoUrl ?? place.photos?.[0]?.url ?? null;
  const whatsapp = place.whatsapp ? whatsappHref(place.whatsapp) : "";
  const phone = place.phone?.trim() ?? "";
  const closed = place.status !== "active";
  const showFichaLink =
    place.id !== DEV_PLACE_ID || (await mayViewDevPlace(place.id));

  /* Agrupación estable por categoría, en el orden en que el dueño la escribió.
     `Map` conserva la inserción, así que «Entrantes» sale antes que «Postres»
     sin ordenar alfabéticamente. Las entradas sin categoría caen en un grupo
     sin nombre que va donde aparezca la primera. */
  const groups: { name: string | null; items: typeof place.menu }[] = [];
  const groupIndex = new Map<string, number>();
  for (const item of place.menu) {
    const name = item.category?.trim() || null;
    const key = name ?? "__sin_categoria__";
    let i = groupIndex.get(key);
    if (i === undefined) {
      i = groups.length;
      groupIndex.set(key, i);
      groups.push({ name, items: [] });
    }
    const group = groups[i];
    if (group) group.items.push(item);
  }
  const namedGroups = groups.filter((group) => group.name !== null);

  return (
    <div className="mx-auto w-full max-w-[680px] px-gutter py-gap-lg">
      <div className="flex items-center justify-between gap-gap-sm pb-gap-md">
        <Link
          href="/"
          className="font-lv-display text-small font-bold tracking-[-0.02em] text-verde-700"
        >
          La Verde
        </Link>
        {showFichaLink && (
          <Link
            href={`/place/${place.id}`}
            className="inline-flex items-center gap-[3px] text-meta font-semibold text-ink-soft/75 transition-colors duration-500 ease-outquint hover:text-verde-700"
          >
            Ver la ficha completa
            <ArrowUpRight size={13} strokeWidth={2} />
          </Link>
        )}
      </div>

      <header className="rounded-3xl border border-ink/5 bg-white p-gap-md shadow-soft">
        <div className="flex items-center gap-gap-md">
          {brand ? (
            <span className="relative block size-14 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-white">
              <Image
                src={brand}
                alt=""
                fill
                sizes="56px"
                quality={70}
                className="object-cover"
              />
            </span>
          ) : (
            <span
              aria-hidden
              className="grid size-14 shrink-0 place-items-center rounded-full bg-sand-deep text-[26px]"
            >
              {categoryEmoji(place.category)}
            </span>
          )}

          <div className="min-w-0">
            <h1 className="font-lv-display text-h3 font-bold leading-tight tracking-[-0.02em] text-ink">
              {place.name}
            </h1>
            <p className="mt-[3px] text-small text-ink-soft/75">
              {[place.category, place.barrio].filter(Boolean).join(" · ")}
            </p>
            {closed && (
              <p className="mt-[6px] inline-flex items-center rounded-full bg-sand-deep px-[10px] py-[3px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft/75">
                {place.status === "closed" ? "Cerrado" : "Cerrado temporalmente"}
              </p>
            )}
          </div>
        </div>

        {place.payments.length > 0 && (
          <p className="mt-gap-sm flex items-center gap-[5px] text-meta text-ink-soft/75">
            <CreditCard size={13} strokeWidth={1.8} className="shrink-0" />
            Acepta {place.payments.map(currencyLabel).join(", ")}
          </p>
        )}

        {(whatsapp || phone) && (
          <div className="mt-gap-md flex flex-wrap gap-gap-xs">
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300"
              >
                <MessageCircle size={16} strokeWidth={1.8} />
                Escribir por WhatsApp
              </a>
            )}
            {phone && (
              <a
                href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex h-11 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600"
              >
                <Phone size={16} strokeWidth={1.8} />
                Llamar
              </a>
            )}
          </div>
        )}
      </header>

      <section className="mt-gap-lg">
        <h2 className="mb-gap-sm font-lv-display text-body font-semibold text-ink">
          Menú
        </h2>

        {place.menu.length === 0 ? (
          <p className="rounded-3xl border border-ink/5 bg-white p-gap-md text-small text-ink-soft/75 shadow-soft">
            {place.name} todavía no ha publicado su menú aquí.
          </p>
        ) : (
          <>
            {/* Navegación por categorías con anclas: sin estado, sin JavaScript.
                Solo aparece con más de una categoría con nombre. */}
            {namedGroups.length > 1 && (
              <nav
                aria-label="Categorías del menú"
                className="mb-gap-sm flex flex-wrap gap-[6px]"
              >
                {namedGroups.map((group) => (
                  <a
                    key={group.name}
                    href={`#cat-${slugify(group.name ?? "") || "general"}`}
                    className="inline-flex items-center rounded-full border border-ink/10 bg-white px-3 py-1.5 font-lv-display text-meta font-medium text-ink-soft/75 transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600"
                  >
                    {group.name}
                  </a>
                ))}
              </nav>
            )}

            {groups.map((group) => (
              <div
                key={group.name ?? "__sin_categoria__"}
                id={`cat-${slugify(group.name ?? "") || "general"}`}
                className="scroll-mt-gap-lg"
              >
                {group.name && (
                  <h3 className="mt-gap-md mb-gap-xs font-lv-display text-small font-semibold uppercase tracking-[0.12em] text-ink-soft/75">
                    {group.name}
                  </h3>
                )}
                <div className="rounded-3xl border border-ink/5 bg-white px-gap-md shadow-soft">
                  {group.items.map((item, index) => (
                    <MenuRow key={`${item.name}-${index}`} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </section>

      <footer className="mt-gap-lg border-t border-ink/5 pt-gap-md text-meta leading-relaxed text-ink-soft/75">
        Los precios y la disponibilidad los pone el negocio. La Verde no gestiona
        los pedidos: se hacen por WhatsApp o por teléfono, como siempre.
      </footer>
    </div>
  );
}
