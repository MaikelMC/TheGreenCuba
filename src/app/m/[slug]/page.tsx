import type { Metadata } from "next";
import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  CreditCard,
  Image as ImageIcon,
  MessageCircle,
  Phone,
} from "lucide-react";
import { getPlaceBySlug } from "@/lib/db/queries";
import {
  DEV_PLACE_ID,
  canViewDevPlace,
  devPlaceIndexable,
} from "@/lib/dev-place";
import { getAppUser } from "@/lib/auth/user";
import { whatsappHref } from "@/lib/contact-links";
import { configReserva } from "@/lib/reserva";
import { configSeguidores } from "@/lib/seguidores";
import { menuUrl } from "@/lib/structured-data";
import { categoryEmoji } from "@/lib/places";
import { tieneFuncion } from "@/lib/plans-server";
import {
  cn,
  currencyLabel,
  formatMenuPrice,
  menuTagFallback,
  menuTagStyles,
  slugify,
} from "@/lib/utils";
import { estaAgotado, type Disponibilidad } from "@/lib/disponibilidad";
import { ofertaDe, ofertasVigentes, precioConOferta } from "@/lib/ofertas";
import {
  BotonAgregar,
  PedidoProvider,
} from "@/components/menu/pedido-whatsapp";
import { EventosMenu } from "@/components/menu/eventos-menu";
import { CartaMenu, type CartaGrupo } from "@/components/menu/carta-menu";
import { ReservaWhatsApp } from "@/components/place/reserva-whatsapp";
import { SeguidorBoton } from "@/components/place/seguidor-boton";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

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
 * **Todo se resuelve en el servidor** —las filas, con la oferta ya emparejada y
 * sin `motion`— y `CartaMenu` tampoco es isla de cliente: sus chips son anclas
 * a los grupos, que están todos en la página. Quien tocaba una categoría cuando
 * esto filtraba perdía de vista el resto de la carta, y el filtro costaba
 * estado en el navegador para esconder lo que ya venía pintado.
 *
 * Las islas de cliente son dos, y ninguna pinta la carta. `EventosMenu` solo
 * cuenta visitas, clics de contacto y productos que entran en pantalla —pide un
 * beacon por visita, no uno por producto, porque la carta la abre gente con
 * datos contados— y `ThemeToggle` es el disco de claro/oscuro.
 *
 * El tema lo pone el sistema por defecto; en la carta se puede cambiar a mano
 * porque quien la abre desde un QR puede venir con el móvil en oscuro y estar a
 * pleno sol.
 *
 * El tope `productos_max` no se aplica al pintar: es antiabuso y ya corta al
 * guardar (ver `PATCH /api/places/[id]`). El menú se enseña completo.
 *
 * `revalidate` deja que la página sea ISR; el contenido cacheado detrás
 * (`getPlaceBySlug`) se invalida con `revalidateTag(CATALOG_TAG)` en cuanto el
 * dueño guarda, así que editar el menú se ve sin esperar al TTL.
 */
export const revalidate = 300;

/**
 * El tamaño de los botones de contacto del encabezado, en móvil.
 *
 * En la carta ancha van sueltos en una fila que envuelve; en un teléfono de
 * 360 px cada pastilla de 44 px ocupaba una línea entera y la cabecera se comía
 * la pantalla antes de la primera entrada del menú. Aquí bajan a 36 px, con
 * menos relleno, letra de 12 px e icono de 14 px, y la fila pasa a rejilla de
 * dos columnas (ver el contenedor) para que caigan alineados y del mismo ancho.
 *
 * 36 px está por debajo de los 44 que pide la guía táctil; el hueco de 8 px que
 * los separa hace que el gesto no roce al botón de al lado, y quien abre la
 * carta viene de un QR y toca una sola vez. De `sm` en adelante recuperan los
 * 44 px.
 */
const BTN_CONTACTO =
  "h-auto min-h-9 w-full justify-center px-gap-sm text-meta [&_svg]:size-3.5 sm:h-11 sm:w-auto sm:px-gap-md sm:text-small sm:[&_svg]:size-4";

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
    return {
      title: "Menú no encontrado",
      robots: { index: false, follow: true },
    };
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
        "flex flex-col rounded-2xl border border-ink/10 bg-white p-gap-xs shadow-soft sm:p-gap-sm",
        agotado && "opacity-60",
      )}
    >
      {/* La foto cuadrada manda la tarjeta y el texto va debajo, dentro de la
          misma caja: el contorno es lo que separa un producto del siguiente, y
          el relleno de la tarjeta es lo que la deja más recogida. */}
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden rounded-lv-lg border border-ink/5 bg-sand-deep text-verde-600",
          agotado && "grayscale",
        )}
      >
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name ? `Foto de ${item.name}` : ""}
            fill
            sizes="(min-width: 768px) 440px, 45vw"
            quality={70}
            className="object-cover"
          />
        ) : (
          /* El mismo hueco que la ficha: quien no subió foto ve el icono de
             «aquí iría una foto», no un plato dibujado por la fuente del
             sistema, que en Windows y en Android sale distinto. */
          <span className="absolute inset-0 grid place-items-center">
            <ImageIcon size={28} strokeWidth={1.8} className="opacity-50" />
          </span>
        )}
      </div>

      {/* `flex-1` + `flex-col`: la tarjeta estirada por la rejilla reparte el
          alto sobrante en el cuerpo del texto, y el precio cae al fondo. */}
      <div className="mt-gap-sm flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-gap-xs">
          {/* Nombre a 16 px en el teléfono y a 22 desde `sm`: a 360 px la
              tarjeta mide ~154 px y un nombre de 22 px se come tres líneas. */}
          <span className="font-lv-display text-body font-bold leading-snug text-ink sm:text-h3">
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
          <div className="line-clamp-2 text-small leading-snug text-ink-soft/75 sm:text-body">
            {item.description}
          </div>
        )}
        {(priceText || item.tag || pedible) && (
          <div className="mt-auto flex flex-wrap items-center gap-gap-xs pt-[6px]">
            {/* `flex-wrap`: en el teléfono la tarjeta mide ~154 px y un precio
                con chapita y «+» ya no cabe en una línea. Que baje el bloque de
                la derecha antes que desbordar. */}
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
                <span className="font-lv-display text-body font-bold leading-snug text-ink sm:text-h3">
                  {priceText}
                </span>
              )
            )}
            {/* La chapita y el «añadir» van juntos a la derecha: el
                `ml-auto` es de los dos, así que da igual cuál de ellos falte. */}
            {(item.tag || pedible) && (
              <span className="ml-auto flex items-center gap-gap-xs">
                {item.tag && (
                  <span
                    className={cn(
                      "rounded-full px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em]",
                      menuTagStyles[item.tag] ?? menuTagFallback,
                    )}
                  >
                    {item.tag}
                  </span>
                )}
                {pedible && (
                  <BotonAgregar
                    producto={{
                      id: productoId,
                      name: item.name,
                      /* El precio que va al pedido es el de la oferta: el
                         carrito arma el mensaje de WhatsApp con esta cifra, y
                         mandarle el de la carta sería pedirle al cliente que
                         pague de más. */
                      price: enOferta && oferta ? oferta.por : item.price,
                      currency: item.currency,
                    }}
                  />
                )}
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

     1. Lo tiene contratado (`whatsapp_pedido`, del módulo Pedidos y reservas).
     2. El dueño no lo ha apagado en Ajustes (`pedidosWhatsapp`).
     3. Hay número al que mandar el pedido.

     El orden importa: los dos que no cuestan nada van primero, así que una
     carta vacía o un negocio sin número —que son la mayoría— no pagan la
     consulta de los permisos. */
  const puedePedir =
    place.menu.length > 0 &&
    place.pedidosWhatsapp &&
    Boolean(place.whatsapp?.trim()) &&
    (await tieneFuncion(place.id, "whatsapp_pedido"));

  /* Las ofertas vivas, filtradas una vez con el «ahora» de esta petición. La
     carta se sirve sin caché de Next —esta página no está en `unstable_cache`—
     así que una oferta que caduque deja de salir en la siguiente visita, sin
     cron y sin escribir nada. Ver `src/lib/ofertas.ts`. */
  const ofertas = ofertasVigentes(place.ofertas);

  /* El botón de reserva, resuelto con el mismo ayudante que la ficha. El plan lo
     decidió `reservaHabilitada` en el mapeo; aquí solo se traduce a botón. */
  const reserva = configReserva(place);
  /* Y el de los avisos, con el mismo reparto: el enlace solo llega resuelto si
     el plan lo incluye y hay bot. La carta es donde alguien ve las ofertas, así
     que aquí el botón vale el doble. */
  const seguidores = configSeguidores(place);

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
  /* Cada grupo, ya montado aquí, con su oferta emparejada. Se enseñan todos:
     los chips de `CartaMenu` solo saltan de uno a otro. */
  const groupsUi: CartaGrupo[] = groups.map((group) => {
    /* El mismo `id` lo usan la sección y el chip que salta a ella. Se calcula
       aquí una vez y viaja en el grupo: con el cálculo copiado en los dos
       sitios, renombrar un grupo dejaba las anclas apuntando al vacío. */
    const id = `cat-${slugify(group.name ?? "") || "general"}`;
    return {
      name: group.name,
      id,
      node: (
        <div
          id={id}
          /* El desplazamiento del ancla tiene que librar la barra de filtros, que
           va pegajosa arriba; si no, el titular del grupo amanece debajo de
           ella. `--carta-filtros-h` es su alto y vive en `globals.css`. */
          className="scroll-mt-[calc(var(--carta-filtros-h)+var(--gap-lg))]"
        >
          {group.name && (
            <h3 className="mt-gap-md mb-gap-sm font-lv-display text-h3 font-bold uppercase tracking-tight text-ink">
              {group.name}
            </h3>
          )}
          {/* Dos columnas siempre, con el hueco corto entre tarjetas. `auto-rows-fr`
            iguala la altura de todas las filas: sin él la tarjeta sin descripción
            queda más baja que la de al lado y la rejilla se ve desalineada. */}
          <div className="grid grid-cols-2 auto-rows-fr gap-gap-sm">
            {group.items.map((item, index) => {
              /* El mismo emparejado que hace la ficha: por `id` del producto, que
               es lo que guarda la oferta. */
              const oferta = item.id ? ofertaDe(ofertas, item.id) : undefined;
              return (
                <MenuRow
                  key={`${item.name}-${index}`}
                  item={item}
                  /* Las entradas nuevas ya traen `id`; las viejas no, y ahí el
                   nombre con su posición es lo único estable que hay. */
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
      ),
    };
  });

  const carta = (
    <div className="mx-auto w-full max-w-[680px] px-gutter py-gap-lg">
      {/* La isla que cuenta la carta. No pinta nada; ver `EventosMenu`. */}
      <EventosMenu negocioId={place.id} />
      {/* `flex-wrap`: en un teléfono de 320 px los controles no caben en una
          línea, y preferimos que la fila baje a que la carta se desplace en
          horizontal, que además arrastraría la barra pegajosa. */}
      <div className="flex flex-wrap items-center justify-between gap-gap-sm pb-gap-md">
        {/* La marca y el interruptor de tema, pegados: el disco no es de la
            carta sino de la página —no cambia de sección ni de vista—, y ahí
            queda como un utensilio junto al nombre en vez de competir con la
            ficha, que sí lleva a algún sitio. */}
        <div className="flex shrink-0 items-center gap-gap-sm">
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
          {/* El mando del tema, explícito: quien abre una carta de un QR puede
              venir con el móvil en oscuro y estar a pleno sol, y en la carta el
              sistema no acierta. */}
          <ThemeToggle />
        </div>

        {showFichaLink && (
          <Link
            href={`/place/${place.id}`}
            className="inline-flex h-11 shrink-0 items-center gap-gap-xs rounded-full border border-verde-200 bg-verde-50 px-gap-md font-lv-display text-meta font-semibold text-verde-700 transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-100 sm:text-small"
          >
            {/* El nombre corto solo en el teléfono: con el texto entero, la
                fila —el disco de La Verde, este botón y el interruptor de
                tema— no cabe en 360 px. Es el mismo recorte que hace el botón
                de WhatsApp. */}
            <span className="sm:hidden">Ver ficha</span>
            <span className="hidden sm:inline">Ver la ficha completa</span>
            <ArrowUpRight size={13} strokeWidth={2} className="shrink-0" />
          </Link>
        )}
      </div>

      <header className="relative rounded-3xl border border-ink/5 bg-white p-gap-md shadow-soft">
        {/* Llamar, en la esquina y sin texto.

            Ocupaba una casilla entera de la rejilla para decir una palabra, y
            es el gesto menos frecuente de los cuatro. Arriba a la derecha no
            compite con la carta y el icono de teléfono ya se entiende; el
            `aria-label` es el que lo nombra para quien no lo ve.

            `size-9` son 36 px, como el resto de la fila en móvil. Va
            posicionado, así que la primera línea del nombre lleva `pr-11` para
            no meterse debajo. */}
        {phone && (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            data-evento="click_llamar"
            aria-label={`Llamar a ${place.name}`}
            title={`Llamar a ${place.name}`}
            className="absolute right-gap-md top-gap-md grid size-9 place-items-center rounded-full border border-ink/10 bg-white text-ink shadow-soft transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600"
          >
            <Phone size={15} strokeWidth={2} />
          </a>
        )}

        <div className="flex items-center gap-gap-md pr-11">
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
            {/* El estado, siempre y no solo cuando está cerrado: quien abre la
                carta desde un QR quiere saber si puede ir ahora, y «no pone
                nada» se lee como que el negocio existe pero no dice nada, no
                como que está abierto. Es la misma pastilla que la ficha —punto
                de color y texto—, en la paleta clara de esta cabecera, que aquí
                el fondo es blanco y no la foto. */}
            <p
              className={cn(
                "mt-[6px] inline-flex items-center gap-[5px] rounded-full border px-[10px] py-[3px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em]",
                closed
                  ? "border-ink/10 bg-sand-deep text-ink-soft/75"
                  : "border-verde-200 bg-verde-50 text-verde-700",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-[6px] shrink-0 rounded-full",
                  closed ? "bg-ink/30" : "bg-verde-500",
                )}
              />
              {place.status === "temporary_closed"
                ? "Cerrado temporalmente"
                : closed
                  ? "Cerrado"
                  : "Abierto"}
            </p>
          </div>
        </div>

        {place.payments.length > 0 && (
          <p className="mt-gap-sm flex items-center gap-[5px] text-meta text-ink-soft/75">
            <CreditCard size={13} strokeWidth={1.8} className="shrink-0" />
            Acepta {place.payments.map(currencyLabel).join(", ")}
          </p>
        )}

        {(reserva || seguidores || whatsapp) && (
          /* Rejilla de dos columnas en móvil y fila que envuelve de `sm` en
             adelante. La rejilla es lo que los ordena: con `flex-wrap` cada
             pastilla medía lo que pedía su texto y las líneas salían de anchos
             distintos y escalonadas. */
          <div className="mt-gap-md grid grid-cols-2 gap-gap-xs sm:flex sm:flex-wrap">
            {/* La reserva va primero: es el gesto que más vale para el negocio
                y el que conviene encontrar sin buscarlo. */}
            {reserva && (
              <ReservaWhatsApp
                reserva={reserva}
                negocioId={place.id}
                className={BTN_CONTACTO}
              />
            )}
            {seguidores && (
              <SeguidorBoton
                seguidores={seguidores}
                negocioId={place.id}
                variant={reserva ? "outline" : "primary"}
                className={BTN_CONTACTO}
              />
            )}
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                data-evento="click_whatsapp"
                className={cn(
                  "inline-flex items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300",
                  BTN_CONTACTO,
                )}
              >
                <MessageCircle
                  size={16}
                  strokeWidth={1.8}
                  className="shrink-0"
                />
                {/* «Escribir por» no cabe en la columna de móvil y era lo que
                    dejaba el hueco de dentro del botón: el texto partía en dos
                    líneas y la segunda no llenaba el ancho. El icono de burbuja
                    y el verde ya dicen de qué va. */}
                <span className="sm:hidden">WhatsApp</span>
                <span className="hidden sm:inline">Escribir por WhatsApp</span>
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
          <CartaMenu groups={groupsUi} />
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
