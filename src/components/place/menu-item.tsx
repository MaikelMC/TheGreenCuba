"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { Image as ImageIcon } from "lucide-react";
import { cn, formatMenuPrice, menuTagFallback, menuTagStyles } from "@/lib/utils";
import { estaAgotado, type Disponibilidad } from "@/lib/disponibilidad";

interface MenuItemProps {
  name: string;
  description: string;
  /** Texto libre, como lo escribió el dueño. Ver `UserPlaceMenuItem`. */
  price: string;
  currency: string;
  tag?: string;
  /**
   * Familia del producto («Entrantes», «Bebidas»). Opcional: media carta no la
   * tiene, y sin ella la fila se lee igual. Ver `UserPlaceMenuItem`.
   *
   * La tarjeta no la pinta —es el chip de la esquina inferior el que se quitó—,
   * pero tiene que seguir en el tipo: los chips de arriba, que sí filtran,
   * sacan de aquí la lista de familias.
   */
  category?: string;
  /**
   * Foto que el dueño puso al producto desde «Lo que ofrece». Sin ella el hueco
   * se queda con el icono de «aquí iría una foto»: mismo dibujo en todas las
   * plataformas, al contrario que un emoji, que cada sistema pinta a su aire.
   */
  image?: string;
  /** «Hoy hay»: estado guardado del producto. Ver `disponibilidad.ts`. */
  disponibilidad?: Disponibilidad;
  agotadoHasta?: number | null;
  /**
   * El precio con oferta flash: el de antes, para tacharlo, y el de ahora.
   *
   * Viene **ya resuelto** y sin la moneda —la pone la fila, que es quien la
   * tiene—. Lo calcula `precioConOferta` al construir el `PlaceData`, y solo
   * llega cuando de verdad hay algo que tachar: un descuento por porcentaje
   * sobre un precio que no es una cifra («3–5 USD») no puede con él.
   */
  oferta?: { de: string; por: string };
  className?: string;
  index?: number;
}

/**
 * La tarjeta de producto de «Lo que ofrece», en la ficha del negocio.
 *
 * Es la misma tarjeta que la de la carta —foto cuadrada arriba, nombre, precio y
 * chapita debajo, sobre fondo blanco con contorno—, para que el producto se
 * reconozca al saltar de la ficha a la carta. Aquí no hay botón de añadir: el
 * carrito es de la carta, que es donde vive el `PedidoProvider`.
 */
export function MenuItem({
  name,
  description,
  price,
  currency,
  tag,
  image,
  disponibilidad,
  agotadoHasta,
  oferta,
  className,
  index = 0,
}: MenuItemProps) {
  const priceText = formatMenuPrice(price, currency);
  /* El estado efectivo, no el guardado: uno marcado como agotado con la fecha
     de vuelta ya pasada se lee como disponible. */
  const agotado = estaAgotado({ disponibilidad, agotadoHasta });
  const enOferta = Boolean(oferta && priceText);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex flex-col rounded-2xl border border-ink/10 bg-white p-gap-xs shadow-soft sm:p-gap-sm",
        /* Agotado no desaparece: se apaga. El producto sigue en la carta —quien
           ya lo conocía lo busca— pero se lee que hoy no hay. */
        agotado && "opacity-60",
        className,
      )}
    >
      {/* La foto va arriba y el texto debajo, dentro de la misma caja: el
          contorno es lo que separa un producto del siguiente.
          Cuadrada y con `object-cover`, igual que la tarjeta de la carta
          pública (`/m/[slug]`): el mismo producto se tiene que ver igual al
          saltar de la ficha a la carta, y la foto vertical de una botella se
          recorta igual en las dos. */}
      <div className="relative aspect-square w-full overflow-hidden rounded-lv-lg border border-ink/5 bg-sand-deep text-verde-600">
        {image ? (
          <Image
            src={image}
            alt={name ? `Foto de ${name}` : ""}
            fill
            sizes="(min-width: 768px) 440px, 45vw"
            quality={70}
            className={cn("object-cover", agotado && "grayscale")}
          />
        ) : (
          <span
            className={cn(
              "absolute inset-0 grid place-items-center",
              agotado && "grayscale",
            )}
          >
            <ImageIcon size={28} strokeWidth={1.8} className="opacity-50" />
          </span>
        )}
        {/* Las chapitas van sobre la foto y no en la fila del nombre: ahí
            empujaban al nombre a una línea más cuando no cabían a su lado, y la
            tarjeta crecía solo por eso. Encima de la foto no ocupan alto de
            texto y todas las tarjetas miden lo mismo. */}
        {(enOferta || agotado) && (
          <span className="absolute left-[6px] top-[6px] flex flex-wrap gap-[4px]">
            {enOferta && (
              <span className="rounded-full bg-verde-400 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-verde-950">
                Oferta
              </span>
            )}
            {agotado && (
              <span className="rounded-full bg-white/95 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-destructive">
                Agotado
              </span>
            )}
          </span>
        )}
      </div>

      {/* `flex-1` + `flex-col`: la tarjeta estirada por la rejilla reparte el
          alto sobrante en el cuerpo del texto, y el precio cae al fondo. */}
      <div className="mt-gap-sm flex min-w-0 flex-1 flex-col">
        {/* Cada bloque reserva su alto: nombre a dos líneas, descripción a dos.
            Sin reserva, una tarjeta con el nombre en una línea o sin descripción
            medía menos que su vecina —y como cada página es su propia rejilla,
            `auto-rows-fr` iguala dentro de una página pero **no entre páginas**,
            así que el tamaño cambiaba al pasar de página—. La reserva va en `em`
            y no en `px` para no repetir la cifra por breakpoint: el nombre sube
            a 22 px desde `sm` y reserva lo suyo solo.
            El nombre va con `line-clamp-2` porque uno de tres líneas estira la
            fila entera y descuadra la tarjeta de al lado. */}
        <span className="line-clamp-2 min-h-[2.75em] font-lv-display text-body font-bold leading-snug text-ink sm:text-h3">
          {name}
        </span>
        {/* Siempre pintada, aunque no haya descripción: el hueco es justamente
            lo que reserva sus dos líneas. */}
        <div className="line-clamp-2 min-h-[2.75em] text-small leading-snug text-ink-soft/75 sm:text-body">
          {description}
        </div>
        {/* La fila se pinta siempre, aunque acabe vacía —un servicio como
            «Wi-Fi gratis» no tiene precio—: es la que reserva su alto, y sin ella
            esa tarjeta mediría menos que las demás. Dos líneas en el teléfono
            —`flex-wrap`: ahí el precio con la categoría y la chapita no cabe en
            una— y el alto natural desde `sm`, donde sí caben.
            El `min-h` lleva el `pt` sumado porque el `box-sizing` es
            `border-box` y el relleno cuenta dentro. */}
        <div className="mt-auto flex min-h-[calc(2.75em+6px)] flex-wrap items-center gap-gap-xs pt-[6px] sm:min-h-0">
          {/* Con oferta se enseña el de antes tachado y el de ahora en verde:
              el precio de siempre no se pinta, o serían tres precios. */}
          {enOferta && oferta ? (
            <span className="flex items-baseline gap-gap-xs">
              <span className="font-lv-display text-meta text-ink-soft/60 line-through">
                {formatMenuPrice(oferta.de, currency)}
              </span>
              <span className="font-lv-display text-small font-semibold text-verde-600">
                {formatMenuPrice(oferta.por, currency)}
              </span>
            </span>
          ) : (
            priceText && (
              <span className="font-lv-display text-body font-bold leading-snug text-ink sm:text-h3">
                {priceText}
              </span>
            )
          )}
          <span className="ml-auto flex flex-wrap items-center gap-gap-xs">
            {tag && (
              <span
                className={cn(
                  "px-[8px] py-[2px] rounded-full font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em]",
                  menuTagStyles[tag] ?? menuTagFallback,
                )}
              >
                {tag}
              </span>
            )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
