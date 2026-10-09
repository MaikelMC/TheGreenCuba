import type { Metadata } from "next";
import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CreditCard, MessageCircle, Phone } from "lucide-react";
import { getPlaceBySlug } from "@/lib/db/queries";
import { DEV_PLACE_ID, canViewDevPlace, devPlaceIndexable } from "@/lib/dev-place";
import { getAppUser } from "@/lib/auth/user";
import { whatsappHref } from "@/lib/contact-links";
import { menuUrl } from "@/lib/structured-data";
import { categoryEmoji } from "@/lib/places";
import { incluye } from "@/lib/plans";
import { planEfectivoDe } from "@/lib/plans-server";
import { cn, currencyLabel, formatMenuPrice, slugify } from "@/lib/utils";
import { estaAgotado, type Disponibilidad } from "@/lib/disponibilidad";
import { ofertaDe, ofertasVigentes, precioConOferta } from "@/lib/ofertas";
import { BotonAgregar, PedidoProvider } from "@/components/menu/pedido-whatsapp";
import { EventosMenu } from "@/components/menu/eventos-menu";
import { Logo } from "@/components/layout/logo";

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
 * **La carta entera se resuelve en el servidor** y las categorías son anclas
 * —enlaces del navegador, no estado de React—. La versión anterior montaba
 * `CartaMenu` (`useState`) y `MenuItem` (`motion/react`): con dos platos ya
 * había JavaScript que no hacía falta.
 *
 * La **única** isla de cliente es `EventosMenu`, y no pinta nada: cuenta las
 * visitas, los clics de contacto y los productos que entran en pantalla. Pide
 * un beacon por visita, no uno por producto, porque la carta la abre gente con
 * datos contados.
 *
 * El tope `productos_max` no se aplica al pintar: es antiabuso y ya corta al
 * guardar (ver `PATCH /api/places/[id]`). El menú se enseña completo.
 *
 * `revalidate` deja que la página sea ISR; el contenido cacheado detrás
 * (`getPlaceBySlug`) se invalida con `revalidateTag(CATALOG_TAG)` en cuanto el
 * dueño guarda, así que editar el menú se ve sin esperar al TTL.
 */
export const revalidate = 300;

const getPlace = cache(async (slug: string, overrideFor?: string) => {
  try {
    /* La carta del negocio de prueba es pública a propósito (se reparte por QR);
       `overrideFor` solo añade encima la copia personal de quien la mira, si es
       su dueño autorizado. Ver `dev-place-server.ts`. */
    return await getPlaceBySlug(slug, {
      includeDev: slug === DEV_PLACE_ID,
      overrideFor,
    });
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
  productoId,
  pedible,
  oferta,
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
  /** Identificador estable del producto, para el carrito. */
  productoId: string;
  /** `true` si el plan incluye pedidos y el producto se puede pedir hoy. */
  pedible: boolean;
  /**
   * El precio de la oferta flash, ya resuelto arriba. `undefined` cuando no hay
   * ninguna viva sobre este producto o cuando no hay cifra que tachar.
   */
  oferta?: { de: string; por: string };
}) {
  const priceText = formatMenuPrice(item.price, item.currency);
  const enOferta = Boolean(oferta && priceText);
  /* Agotado no es «no está»: el producto sigue en la carta, apagado y con la
     etiqueta, para que quien lo buscaba sepa que hoy no hay sin creer que
     desapareció del menú. */
  const agotado = estaAgotado(item);

  return (
    <div
      /* `data-producto` lo lee la isla de eventos para contar qué se ve. Es el
         nombre y no el id porque el id puede faltar en las entradas viejas. */
      data-producto={item.name}
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
          {enOferta && (
            <span className="rounded-full bg-verde-400 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-verde-950">
              Oferta
            </span>
          )}
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
            {enOferta && oferta ? (
              <span className="flex items-baseline gap-gap-xs">
                <span className="font-lv-display text-meta text-ink-soft/60 line-through">
                  {formatMenuPrice(oferta.de, item.currency)}
                </span>
                <span className="font-lv-display text-small font-semibold text-verde-600">
                  {formatMenuPrice(oferta.por, item.currency)}
                </span>
              </span>
            ) : (
              priceText && (
                <span className="font-lv-display text-small font-semibold text-ink">
                  {priceText}
                </span>
              )
            )}
            {item.tag && (
              <span className="ml-auto rounded-full bg-verde-100 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-verde-700">
                {item.tag}
              </span>
            )}
          </div>
        )}
      </div>

      {pedible && (
        <div className="self-center">
          <BotonAgregar
            producto={{
              id: productoId,
              name: item.name,
              /* El precio que va al pedido es el de la oferta: el carrito arma
                 el mensaje de WhatsApp con esta cifra, y mandarle el de la
                 carta sería pedirle al cliente que pague de más. */
              price: enOferta && oferta ? oferta.por : item.price,
              currency: item.currency,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default async function MenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  /* Solo el negocio de prueba pregunta por la sesión; el resto de cartas no
     paga nada por esto. */
  const devUser = slug === DEV_PLACE_ID ? await getAppUser() : null;
  const overrideFor =
    devUser?.id && canViewDevPlace(devUser.email) ? devUser.id : undefined;
  const place = await getPlace(slug, overrideFor);
  if (!place) notFound();

  const brand = place.logoUrl ?? place.photos?.[0]?.url ?? null;
  const whatsapp = place.whatsapp ? whatsappHref(place.whatsapp) : "";
  const phone = place.phone?.trim() ?? "";
  const closed = place.status !== "active";
  const showFichaLink =
    place.id !== DEV_PLACE_ID || canViewDevPlace(devUser?.email);

  /* El carrito necesita **tres** síes, y se comprueban aquí, en el servidor: el
     navegador solo pinta lo que le llega.

     1. El plan lo incluye (`whatsapp_pedido`, Básico+).
     2. El dueño no lo ha apagado en Ajustes (`pedidosWhatsapp`).
     3. Hay número al que mandar el pedido.

     El orden importa: los dos que no cuestan nada van primero, así que una
     carta vacía o un negocio sin número —que son la mayoría— no pagan la
     consulta del plan. */
  const puedePedir =
    place.menu.length > 0 &&
    place.pedidosWhatsapp &&
    Boolean(place.whatsapp?.trim()) &&
    incluye(await planEfectivoDe(place.id), "whatsapp_pedido");

  /* Las ofertas vivas, filtradas una vez con el «ahora» de esta petición. La
     carta se sirve sin caché de Next —esta página no está en `unstable_cache`—
     así que una oferta que caduque deja de salir en la siguiente visita, sin
     cron y sin escribir nada. Ver `src/lib/ofertas.ts`. */
  const ofertas = ofertasVigentes(place.ofertas);

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

  const carta = (
    <div className="mx-auto w-full max-w-[680px] px-gutter py-gap-lg">
      {/* La isla que cuenta la carta. No pinta nada; ver `EventosMenu`. */}
      <EventosMenu negocioId={place.id} />
      <div className="flex items-center justify-between gap-gap-sm pb-gap-md">
        {/* El logotipo al lado del nombre, como en la cabecera del mapa: el
            dibujo se reconoce y el texto lo dice, que en una carta que se abre
            una vez y sin conocer la marca hace falta.

            Con pastilla de botón —borde, fondo blanco y 44 px de alto—, no
            suelto: el nombre en verde sobre el fondo se leía como un rótulo más
            de la carta y no como lo que es, el único enlace que sale del
            negocio. Es la misma pastilla secundaria que «Llamar» en la ficha de
            abajo, así que el gesto se aprende una vez. */}
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-verde-700 shadow-soft transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600"
        >
          <Logo className="h-[22px] w-auto shrink-0" />
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
                data-evento="click_whatsapp"
                className="inline-flex h-11 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300"
              >
                <MessageCircle size={16} strokeWidth={1.8} />
                Escribir por WhatsApp
              </a>
            )}
            {phone && (
              <a
                href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                data-evento="click_llamar"
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
                  {group.items.map((item, index) => {
                    /* El mismo emparejado que hace la ficha: por `id` del
                       producto, que es lo que guarda la oferta. */
                    const oferta = item.id ? ofertaDe(ofertas, item.id) : undefined;
                    return (
                      <MenuRow
                        key={`${item.name}-${index}`}
                        item={item}
                        /* Las entradas nuevas ya traen `id`; las viejas no, y ahí
                           el nombre con su posición es lo único estable que hay. */
                        productoId={item.id ?? `${item.name}-${index}`}
                        pedible={puedePedir && !estaAgotado(item)}
                        oferta={
                          oferta
                            ? (precioConOferta(item.price, oferta) ?? undefined)
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </section>

      <footer className="mt-gap-lg border-t border-ink/5 pt-gap-md">
        {/* La invitación a unirse, en una línea y sin tarjeta: quien llega por
            un QR viene a ver la carta de un negocio, no a que le vendan una
            cuenta. El enlace es el mismo gesto que «Ver la ficha completa» de
            arriba —texto con flecha—, no un botón que compita con la carta. */}
        <div className="flex flex-wrap items-center justify-between gap-gap-sm">
          <p className="text-small text-ink-soft/75">
            Únete a La Verde, descubre lugares en Cuba y obtén tu propio
            catálogo online.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-[3px] font-lv-display text-small font-semibold text-verde-700 transition-colors duration-500 ease-outquint hover:text-verde-600"
          >
            Crear cuenta
            <ArrowUpRight size={13} strokeWidth={2} />
          </Link>
        </div>

        <p className="mt-gap-md text-meta leading-relaxed text-ink-soft/75">
          Los precios y la disponibilidad los pone el negocio. La Verde no
          gestiona los pedidos: se hacen por WhatsApp o por teléfono, como
          siempre.
        </p>
      </footer>
    </div>
  );

  /* Sin el plan, sin número o en una carta vacía, el carrito no existe: se
     devuelve la carta tal cual y no se manda ni un byte de JavaScript de más. */
  if (!puedePedir) return carta;

  return (
    <PedidoProvider
      placeId={place.id}
      negocio={place.name}
      /* `puedePedir` ya garantiza que hay número; el `?? ""` es para que
         TypeScript lo sepa. */
      whatsapp={place.whatsapp ?? ""}
    >
      {carta}
    </PedidoProvider>
  );
}
