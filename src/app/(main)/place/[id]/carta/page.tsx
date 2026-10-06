import type { Metadata } from "next";
import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CreditCard, MessageCircle, Phone } from "lucide-react";
import { getPlaceById } from "@/lib/db/queries";
import { DEV_PLACE_ID, devPlaceIndexable, mayViewDevPlace } from "@/lib/dev-place";
import { whatsappHref } from "@/lib/contact-links";
import { menuUrl } from "@/lib/structured-data";
import { placeIcon } from "@/lib/places";
import { currencyLabel } from "@/lib/utils";
import { CategoryIcon } from "@/components/admin/category-icon";
import { CartaMenu } from "@/components/place/carta-menu";

/**
 * La carta pública de un negocio.
 *
 * Es el enlace que el dueño comparte —por WhatsApp, en un QR pegado a la mesa—
 * y quien lo recibe **no necesita cuenta**: cuelga de `/place`, que el proxy
 * deja abierto a propósito porque los enlaces se comparten.
 *
 * Existe aparte de la ficha porque la ficha es otra cosa. Quien abre un menú
 * desde el móvil quiere precios, no un carrusel a pantalla completa, ni Leaflet
 * con sus teselas, ni reseñas: todo eso viaja en `/place/[id]` y aquí no se
 * pide nada de ello. Se reusa `MenuItem`, que es el mismo que pinta la ficha,
 * para que el plato se vea igual en los dos sitios.
 *
 * Sin estado y sin `"use client"`: la carta entera se resuelve en el servidor.
 */
const getPlace = cache(async (id: string) => {
  try {
    /* Sin sesión de por medio, y ahí está la diferencia con la ficha: la carta
       es lo que se reparte —por WhatsApp, en un QR pegado a una mesa— y un menú
       que solo abre su dueño no sirve para repartirlo. El negocio de prueba
       entra para todo el mundo; su ficha, no. Ver `dev-place.ts`.

       El id se compara aquí y no se le pasa un `true` pelado: así la carta de
       un negocio de verdad comparte la clave de caché con su ficha, en vez de
       tener una entrada propia para siempre. */
    return await getPlaceById(id, { includeDev: id === DEV_PLACE_ID });
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const place = await getPlace(id);

  if (!place) {
    return {
      title: "Carta no encontrada",
      robots: { index: false, follow: true },
    };
  }

  const where = place.city || place.barrio || "Cuba";
  const count = place.menu.length;
  const title = `Carta de ${place.name} — ${place.category} en ${where}`;
  const description = count
    ? `${count} ${count === 1 ? "entrada" : "entradas"} con precios y fotos en la carta de ${place.name}.`
    : `${place.name}, ${place.category} en ${where}.`;
  const cover = place.logoUrl ?? place.photos?.[0]?.url;

  return {
    title,
    description,
    /* Relativa: la resuelve `metadataBase`, igual que en la ficha. */
    alternates: { canonical: `/place/${place.id}/carta` },
    openGraph: {
      type: "website",
      title,
      description,
      url: menuUrl(place.id),
      images: cover ? [cover] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
    /* Solo se indexa una carta publicada y con algo dentro. Aquí se pide
       además `isActive`, que la ficha no pide: una ficha sin publicar se enseña
       porque el enlace ya está repartido, pero la carta la reparte el dueño
       **después** de que se la aprueben —el panel no se abre antes—, así que
       una carta de un negocio sin aprobar no debería entrar en el índice. */
    robots:
      place.isActive &&
      place.status === "active" &&
      count > 0 &&
      devPlaceIndexable(place.id)
        ? undefined
        : { index: false, follow: true },
  };
}

export default async function CartaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const place = await getPlace(id);

  /* `notFound` y no una vista vacía: aquí no hay nada que enseñar si el negocio
     no está. El precio es que un Neon caído también responde 404 —el `catch` de
     arriba devuelve `null`—; con la base caída no hay carta que servir de todos
     modos, y una URL compartida que contesta 404 se entiende mejor que una que
     revienta con un error del servidor. */
  if (!place) notFound();

  const brand = place.logoUrl ?? place.photos?.[0]?.url ?? null;
  const whatsapp = place.whatsapp ? whatsappHref(place.whatsapp) : "";
  const phone = place.phone?.trim() ?? "";
  const closed = place.status !== "active";

  /* El enlace a la ficha solo se pinta si quien mira puede abrirla. La carta
     del negocio de prueba es pública y su ficha no: a quien llegue por el QR
     este enlace le daría un 404. Para un negocio de verdad la primera mitad de
     la condición es cierta y no se consulta la sesión para nada. */
  const showFichaLink =
    place.id !== DEV_PLACE_ID || (await mayViewDevPlace(place.id));

  return (
    <div className="mx-auto w-full max-w-[680px] px-gutter py-gap-lg">
      {/* Arriba y no en un pie: quien llega desde WhatsApp tiene que poder
          volver a la ficha sin recorrer la carta entera. */}
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
              <Image src={brand} alt="" fill sizes="56px" className="object-cover" />
            </span>
          ) : (
            /* Sin logo ni fotos, el icono de su categoría: es el mismo que
               lleva su pin en el mapa, así que el negocio se reconoce igual. */
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-sand-deep text-verde-600">
              <CategoryIcon
                icon={placeIcon(place.icon, place.category)}
                size={24}
                strokeWidth={1.8}
              />
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

        {/* Las monedas que acepta. En un menú cubano es medio dato: el precio
            no sirve de nada si quien lo lee no trae esa moneda. */}
        {place.payments.length > 0 && (
          <p className="mt-gap-sm flex items-center gap-[5px] text-meta text-ink-soft/75">
            <CreditCard size={13} strokeWidth={1.8} className="shrink-0" />
            Acepta {place.payments.map(currencyLabel).join(", ")}
          </p>
        )}

        {/* El contacto va arriba y no al final: con una carta de veinte platos,
            el botón de pedir es lo último a lo que se llega. */}
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
          Carta
        </h2>

        {place.menu.length > 0 ? (
          /* La barra de categorías y el filtrado son lo único con estado; el
             resto de la carta se resuelve en el servidor. Ver `CartaMenu`. */
          <CartaMenu items={place.menu} />
        ) : (
          <p className="rounded-3xl border border-ink/5 bg-white p-gap-md text-small text-ink-soft/75 shadow-soft">
            {place.name} todavía no ha publicado su carta aquí.
          </p>
        )}
      </section>

      <footer className="mt-gap-lg border-t border-ink/5 pt-gap-md text-meta leading-relaxed text-ink-soft/75">
        Los precios y la disponibilidad los pone el negocio. La Verde no gestiona
        los pedidos: se hacen por WhatsApp o por teléfono, como siempre.
      </footer>
    </div>
  );
}
