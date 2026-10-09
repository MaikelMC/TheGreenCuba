"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { Image as ImageIcon } from "lucide-react";
import { cn, formatMenuPrice } from "@/lib/utils";
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
  imageEmoji?: string;
  /**
   * Foto que el dueño puso al producto desde «Lo que ofrece».
   *
   * Va antes que el emoji y no después: si hay foto, la foto manda —el emoji
   * era el relleno de cuando no había con qué llenar este hueco.
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

/* Mismo mapa y **mismas claves** que `TAG_STYLES` del `menu-item-editor`: la
   chapita que el dueño pone en el panel y la que sale aquí son la misma, y con
   vocabularios distintos —aquí eran `popular`/`new`/`offer` en minúscula— el
   `tag` guardado no casaba con ningún estilo. */
const TAG_STYLES: Record<string, string> = {
  Popular: "bg-verde-100 text-verde-700",
  Nuevo: "bg-verde-50 text-verde-600",
  "2x1": "bg-sand-deep text-ink-soft/75",
};

/* Una etiqueta que el panel no conozca se pinta igual, en arena. Mejor una
   chapita sin color propio que una chapita invisible. */
const TAG_FALLBACK = "bg-sand text-ink-soft/75";

export function MenuItem({
  name,
  description,
  price,
  currency,
  tag,
  category,
  imageEmoji,
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
      {/* Hueco de la foto: la imagen subida, o el emoji, o el icono. */}
      <div
        className={cn(
          "relative size-[72px] rounded-2xl bg-sand-deep shrink-0 grid place-items-center overflow-hidden text-verde-600",
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
        ) : imageEmoji ? (
          <span className="text-[28px]">{imageEmoji}</span>
        ) : (
          <ImageIcon size={24} strokeWidth={1.8} className="opacity-50" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
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
                  TAG_STYLES[tag] ?? TAG_FALLBACK,
                )}
              >
                {tag}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
