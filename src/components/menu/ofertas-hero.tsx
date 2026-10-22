import Image from "next/image";
import { ArrowDown, Clock, Image as ImageIcon } from "lucide-react";
import type { UserPlaceMenuItem, UserPlaceOferta } from "@/lib/places-store";
import { BotonAgregar } from "@/components/menu/pedido-whatsapp";
import { OfertasCarrusel } from "@/components/menu/ofertas-carrusel";
import { formatMenuPrice, slugify } from "@/lib/utils";

/**
 * Las ofertas vivas del negocio, como bloque destacado de la carta.
 *
 * Va antes que el menú porque una oferta sirve para eso: que se vea sin bajar.
 * Se pinta entera en el servidor —nada de `motion` ni de contadores en el
 * navegador— y la única isla de cliente es el pase de tarjetas y el «+» del
 * carrito, que ya existía.
 *
 * Una tarjeta por producto: si el dueño encadenó dos ofertas sobre el mismo
 * plato, manda la que antes caduca (el orden que trae `ofertasVigentes`), igual
 * que hace la fila del menú. Los productos borrados de la carta se descartan
 * aquí: una oferta huérfana no tiene precio ni foto que enseñar.
 *
 * La tarjeta es rectangular —foto a la izquierda, datos a la derecha— y más
 * baja que la de un producto: es un destacado, no una entrada más de la carta.
 * Con varias ofertas se enseñan de una en una para no empujar el menú.
 */

export interface OfertaDestacada {
  oferta: UserPlaceOferta;
  item: UserPlaceMenuItem;
  productoId: string;
  /** `null` cuando el precio de la carta no es una cifra ni un rango. */
  precios: { de: string; por: string } | null;
  /** Hay carrito y el producto se puede pedir hoy. */
  pedible: boolean;
  agotado: boolean;
}

const fechaCorta = new Intl.DateTimeFormat("es-CU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  /* El servidor puede correr en UTC; la hora de la oferta es la de Cuba. */
  timeZone: "America/Havana",
});

export function OfertasHero({ ofertas }: { ofertas: OfertaDestacada[] }) {
  if (ofertas.length === 0) return null;

  /* La foto mide ~40 % de la tarjeta, que no pasa de 680 px de ancho. */
  const sizes = "(min-width: 680px) 280px, 36vw";

  return (
    <section
      aria-labelledby="ofertas-titulo"
      /* Para el buscador: si ningún producto en oferta coincide, la sección
         entera se esconde en vez de quedar un titular sin tarjetas. */
      data-grupo
      className="mt-gap-md"
    >
      <div className="mb-gap-sm flex flex-wrap items-end justify-between gap-x-gap-sm gap-y-[2px]">
        <h2
          id="ofertas-titulo"
          className="font-lv-display text-h3 font-semibold text-ink"
        >
          Ofertas
        </h2>
        <p className="text-meta text-ink-soft/75">
          {ofertas.length === 1
            ? "1 producto rebajado"
            : `${ofertas.length} productos rebajados`}{" "}
          por tiempo limitado
        </p>
      </div>

      <OfertasCarrusel>
        {ofertas.map(({ oferta, item, productoId, precios, pedible, agotado }) => {
          const currency = item.currency || "MLC";
          const descuento = oferta.descuentoPct
            ? `−${oferta.descuentoPct}%`
            : "Precio rebajado";
          /* El ancla del chip de la categoría ya existe en la carta; si la
             entrada no tiene categoría, el botón lleva al titular del menú. */
          const categoria = item.category?.trim();
          const ancla = categoria
            ? `#cat-${slugify(categoria) || "general"}`
            : "#menu";

          return (
            <article
              key={oferta.id}
              data-buscar={`${item.name} ${item.description} ${oferta.titulo} ${oferta.descripcion ?? ""}`}
              /* La misma caja que `MenuRow` —borde fino y sombra corta—, pero
                 en horizontal. La tarjeta no es un enlace, así que no se
                 levanta; el borde verde de «ya está en el pedido» sale de
                 `:has()` mirando lo que escribe el botón. */
              className="flex overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-soft has-[[data-en-pedido]]:border-verde-400"
            >
              {/* La foto se estira con el texto: no hay alto fijo que recorte
                  una descripción larga ni hueco bajo una corta. */}
              <div className="relative w-[36%] shrink-0 self-stretch overflow-hidden border-r border-ink/5 bg-sand-deep text-verde-600 sm:w-[40%]">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={`Foto de ${item.name}`}
                    fill
                    sizes={sizes}
                    quality={70}
                    className="object-cover"
                  />
                ) : (
                  <span className="absolute inset-0 grid place-items-center">
                    <ImageIcon size={28} strokeWidth={1.8} className="opacity-50" />
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col p-gap-sm sm:p-gap-md">
                <div className="flex flex-wrap items-center gap-gap-xs">
                  <span className="font-lv-display text-body font-bold leading-snug text-ink sm:text-h3">
                    {oferta.titulo}
                  </span>
                  {/* Las chapitas van en la fila del nombre, como en la carta:
                      «Oferta» se cambia por el descuento, que dice más. */}
                  <span className="rounded-full bg-verde-400 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-verde-950">
                    {descuento}
                  </span>
                  {agotado && (
                    <span className="rounded-full bg-sand-deep px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                      Agotado
                    </span>
                  )}
                </div>

                {/* Si el título ya es el nombre del producto, repetirlo sería
                    ruido; cuando no, el cliente necesita saber qué se rebaja. */}
                {oferta.titulo.trim() !== item.name.trim() && (
                  <div className="line-clamp-1 text-small text-ink-soft/75">
                    {item.name}
                  </div>
                )}
                {oferta.descripcion && (
                  <div className="line-clamp-2 text-meta leading-snug text-ink-soft/75 sm:text-small">
                    {oferta.descripcion}
                  </div>
                )}

                <p className="mt-gap-xs flex items-center gap-[5px] text-meta text-ink-soft/70">
                  <Clock size={11} strokeWidth={2} className="shrink-0" aria-hidden />
                  Termina el {fechaCorta.format(oferta.termina)}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-gap-xs pt-[6px]">
                  {precios ? (
                    <span className="flex items-baseline gap-gap-xs">
                      <span className="font-lv-display text-meta text-ink-soft/75 line-through">
                        {formatMenuPrice(precios.de, currency)}
                      </span>
                      <span className="font-lv-display text-small font-semibold text-verde-600">
                        {formatMenuPrice(precios.por, currency)}
                      </span>
                    </span>
                  ) : (
                    item.price && (
                      <span className="font-lv-display text-body font-bold leading-snug text-ink sm:text-h3">
                        {formatMenuPrice(item.price, currency)}
                      </span>
                    )
                  )}
                  <span className="ml-auto flex items-center gap-gap-xs">
                    {pedible ? (
                      <BotonAgregar
                        producto={{
                          id: productoId,
                          name: item.name,
                          /* El precio de la oferta es el que viaja al pedido. */
                          price: precios?.por ?? item.price,
                          currency,
                        }}
                      />
                    ) : (
                      <a
                        href={ancla}
                        className="inline-flex items-center gap-[3px] font-lv-display text-meta font-semibold text-verde-700 transition-colors duration-500 ease-outquint hover:text-verde-600"
                      >
                        Ver en el menú
                        <ArrowDown size={13} strokeWidth={2} aria-hidden />
                      </a>
                    )}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </OfertasCarrusel>
    </section>
  );
}
