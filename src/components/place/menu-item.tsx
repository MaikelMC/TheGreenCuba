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
  /** Familia del producto («Entrantes», «Bebidas»). Opcional: media carta no
      la tiene, y sin ella la fila se lee igual. Ver `UserPlaceMenuItem`. */
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

export function MenuItem({
  name,
  description,
  price,
  currency,
  tag,
  category,
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
      whileHover={{ x: 4 }}
      className={cn(
        "flex gap-gap-md py-gap-md border-b border-ink/5 last:border-b-0",
        /* Agotado no desaparece: se apaga. El producto sigue en la carta —quien
           ya lo conocía lo busca— pero se lee que hoy no hay. */
        agotado && "opacity-60",
        className,
      )}
    >
      {/* El texto va primero y la foto a la derecha: es el orden de una lista
          —se lee el nombre, luego el precio— y deja la foto pegada al borde,
          que es lo que se reconoce de un vistazo al bajar por la carta. */}
      <div className="min-w-0 flex-1">
        <div className="mb-[2px] flex flex-wrap items-center gap-gap-xs">
          <span className="font-lv-display text-small font-semibold text-ink">
            {name}
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
        <div className="text-meta text-ink-soft/75 leading-snug line-clamp-2">
          {description}
        </div>
        {/* Sin precio, chapita ni categoría no hay fila: `formatMenuPrice`
            devuelve cadena vacía cuando el dueño no puso precio, que es el caso
            de un servicio como «Wi-Fi gratis». */}
        {(priceText || tag || category) && (
          <div className="flex items-center gap-gap-xs mt-[6px]">
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
                <span className="font-lv-display text-small font-semibold text-ink">
                  {priceText}
                </span>
              )
            )}
            {/* La categoría en gris y no en verde: es una etiqueta de orden, no
                un reclamo. El verde está reservado para lo que vende. */}
            {category && (
              <span className="px-[8px] py-[2px] rounded-full bg-sand font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft/75">
                {category}
              </span>
            )}
            {tag && (
              <span
                className={cn(
                  /* `ml-auto` para que la chapita siga pegada a la derecha
                     cuando es lo único que queda en la fila. */
                  "ml-auto px-[8px] py-[2px] rounded-full font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em]",
                  menuTagStyles[tag] ?? menuTagFallback,
                )}
              >
                {tag}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hueco de la foto: la imagen subida, o el icono. */}
      <div
        className={cn(
          "relative grid size-[72px] shrink-0 place-items-center overflow-hidden rounded-2xl bg-sand-deep text-verde-600",
          agotado && "grayscale",
        )}
      >
        {image ? (
          <Image
            src={image}
            alt={name ? `Foto de ${name}` : ""}
            fill
            sizes="72px"
            className="object-cover"
          />
        ) : (
          <ImageIcon size={24} strokeWidth={1.8} className="opacity-50" />
        )}
      </div>
    </motion.div>
  );
}
