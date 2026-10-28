"use client";

import { Heart, MapPin, Star, Tag, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/admin/category-icon";

interface PlaceCardProps {
  /** Ruta de la ficha. La tarjeta entera es el enlace: el nombre lleva el
      `<a>` y su `::after` cubre la card. */
  href: string;
  name: string;
  /** Ya compuesto: «Categoría · Barrio». */
  category: string;
  rating: number;
  distance: string;
  price: string;
  tags: { label: string; variant?: "mlc" | "open" | "default" }[];
  /** Nombre del icono Lucide del negocio. Sin él, el genérico. */
  icon?: string;
  /** Logo del negocio. Si lo hay manda sobre el icono. */
  logoUrl?: string;
  /** Insignia «Top del mes», ya resuelta por el servidor. */
  topDelMes?: boolean;
  /** Negocio destacado: estrella dorada sobre el logo, sin chip. */
  boosted?: boolean;
  selected?: boolean;
  liked?: boolean;
  index?: number;
  onLike?: () => void;
  onLocate?: () => void;
}

/* Chapitas de 22 px. `whitespace-nowrap` es lo que evita la palabra huérfana:
   un chip nunca se parte; si no caben, se van a la línea siguiente enteros. */
const chipBase =
  "inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 font-lv-display text-[12px] font-medium leading-none";

/* El texto secundario no usa `ink-soft/75` porque el override oscuro global lo
   sube casi a blanco; la referencia del diseño pide un gris azulado apagado. */
const metaText = "text-[#5b6b7a] dark:text-[#9fb0c0]";

export function PlaceCard({
  href,
  name,
  category,
  rating,
  distance,
  price,
  tags,
  icon,
  logoUrl,
  topDelMes,
  boosted,
  selected,
  liked,
  index = 0,
  onLike,
  onLocate,
}: PlaceCardProps) {
  /* Solo hay distancia si viene medida. El respaldo del catálogo («Ver en el
     mapa», una dirección) no es un número: se calla en vez de colgar un «—». */
  const distanceLabel = /^\d+(?:[.,]\d+)?\s(?:m|km)$/.test(distance)
    ? distance
    : null;
  /* `price` llega como «—» cuando no hay dato; tampoco se pinta. */
  const realPrice = price && price !== "—" ? price : null;

  const state = tags.find((t) => t.label === "Abierto" || t.label === "Cerrado");
  const isOpen = state?.label === "Abierto";
  const offer = tags.find((t) => t.label === "Oferta");
  /* «Destacado» no va como chip: es la estrella del logo. */
  const rest = tags.filter(
    (t) => t.label !== state?.label && t.label !== "Oferta" && t.label !== "Destacado",
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      /* El retardo se corta a las ocho primeras tarjetas. Sin tope, la lista
         completa —hasta doscientas— escalonaba una detrás de otra y las de
         abajo tardaban segundos en aparecer, justo cuando el usuario ya había
         bajado a buscarlas. */
      transition={{
        delay: Math.min(index, 8) * 0.05,
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "relative flex gap-[12px] rounded-2xl border p-3 transition-[border-color,background-color,box-shadow] duration-300",
        "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-verde-400",
        selected
          ? "border-verde-400 bg-verde-50"
          : "border-ink/5 bg-[#ffffff] hover:border-verde-300 hover:shadow-soft dark:bg-[#121e2a] dark:hover:border-[#2f5a43]",
      )}
    >
      {/* Logo. El marco exterior no recorta: la estrella de «Destacado» asoma
          6 px por fuera del borde redondeado. */}
      <div className="relative size-16 shrink-0">
        <div className="recommendation-place-thumb relative grid size-16 place-items-center overflow-hidden rounded-lv-lg bg-gradient-to-br from-verde-50 to-verde-100">
          {logoUrl ? (
            <Image src={logoUrl} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <CategoryIcon icon={icon} size={30} strokeWidth={1.6} className="text-verde-600" />
          )}
        </div>
        {boosted && (
          <span
            role="img"
            aria-label="Destacado"
            className="absolute -left-[6px] -top-[6px] z-[1] grid size-5 place-items-center rounded-full border-2 border-[#ffffff] bg-[#f2c14e] dark:border-[#121e2a]"
          >
            <Star
              size={12}
              strokeWidth={2.4}
              fill="currentColor"
              aria-hidden="true"
              className="text-[#3b2a05]"
            />
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        {/* Fila 1: nombre + corazón */}
        <div className="flex min-w-0 items-center gap-1">
          <Link
            href={href}
            className="min-w-0 flex-1 rounded-2xl outline-none after:absolute after:inset-0 after:rounded-2xl after:content-['']"
          >
            <span className="block truncate font-lv-display text-[16px] font-semibold leading-6 tracking-[-0.01em] text-ink">
              {name}
            </span>
          </Link>
          <motion.button
            type="button"
            whileTap={{ scale: 1.3 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            onClick={onLike}
            aria-pressed={liked}
            aria-label={`Guardar ${name} en favoritos`}
            className="relative z-[1] -my-[11px] -mr-[9px] grid size-11 shrink-0 place-items-center rounded-full"
          >
            <Heart
              size={20}
              strokeWidth={1.8}
              aria-hidden="true"
              fill={liked ? "#ff6b81" : "none"}
              className={liked ? "text-[#ff6b81]" : "text-ink-soft/60"}
            />
          </motion.button>
        </div>

        {/* Fila 2: categoría · barrio (+ datos reales) y distancia */}
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-[13px] leading-[18px]", metaText)}>
            {category}
            {rating > 0 && (
              <>
                {" · "}
                <span aria-hidden="true">★ </span>
                {rating}
              </>
            )}
            {realPrice && <>{" · "}{realPrice}</>}
          </span>
          <button
            type="button"
            onClick={onLocate}
            aria-label={
              distanceLabel
                ? `Ver ${name} en el mapa, a ${distanceLabel}`
                : `Ver ${name} en el mapa`
            }
            className="relative z-[1] -my-[13px] inline-flex h-11 shrink-0 items-center rounded-full"
          >
            <span className="inline-flex h-6 items-center gap-[3px] rounded-full bg-[#1a2733] px-[9px] font-lv-display text-[12px] font-medium leading-none text-[#d7e2ec] transition-colors duration-300 hover:bg-[#223443]">
              <MapPin
                size={12}
                strokeWidth={2}
                aria-hidden="true"
                className="text-[#86e3a3]"
              />
              {distanceLabel}
            </span>
          </button>
        </div>

        {/* Fila 3: estado, oferta/top del mes, plan o neutrales */}
        {(state || offer || topDelMes || rest.length > 0) && (
          <div className="mt-[6px] flex flex-wrap gap-[6px]">
            {state && (
              <span
                className={cn(
                  chipBase,
                  isOpen
                    ? "bg-verde-100 text-verde-700"
                    : "bg-sand-deep text-ink-soft/75",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-[6px] rounded-full",
                    isOpen ? "bg-verde-500 dark:bg-[#86e3a3]" : "bg-[#7a8794]",
                  )}
                />
                {state.label}
              </span>
            )}
            {offer && (
              <span
                className={cn(
                  chipBase,
                  "bg-[#fdf1d6] text-[#8a5a00] dark:bg-[#35280f] dark:text-[#f2c14e]",
                )}
              >
                <Tag size={12} strokeWidth={2} aria-hidden="true" />
                {offer.label}
              </span>
            )}
            {topDelMes && (
              <span
                className={cn(
                  chipBase,
                  "border border-[#c9963a] text-[#8a5a00] dark:border-[#8a6f2c] dark:text-[#f2c14e]",
                )}
              >
                <Trophy size={12} strokeWidth={2} aria-hidden="true" />
                Top del mes
              </span>
            )}
            {rest.map((tag) => (
              <span
                key={tag.label}
                className={cn(
                  chipBase,
                  tag.variant === "open"
                    ? "bg-verde-100 text-verde-700"
                    : "bg-sand-deep text-ink-soft/75",
                )}
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
