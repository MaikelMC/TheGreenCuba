"use client";

import { Heart, ArrowRight, Star, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/admin/category-icon";

interface PlaceCardProps {
  name: string;
  category: string;
  rating: number;
  distance: string;
  price: string;
  tags: { label: string; variant?: "mlc" | "open" | "default" }[];
  /** Nombre del icono Lucide del negocio. Sin él, el genérico. */
  icon?: string;
  selected?: boolean;
  liked?: boolean;
  index?: number;
  onSelect?: () => void;
  onLike?: () => void;
  onDetail?: () => void;
  onLocate?: () => void;
}

/* Etiquetas del sistema: sin bordes, solo tinte de fondo. `open` es la única
   positiva; las demás son informativas y van en la escala neutra de arena. */
const tagStyles: Record<string, string> = {
  mlc: "bg-sand-deep text-ink-soft/75",
  open: "bg-verde-100 text-verde-700",
  default: "bg-sand text-ink-soft/75",
};

export function PlaceCard({
  name,
  category,
  rating,
  distance,
  price,
  tags,
  icon,
  selected,
  liked,
  index = 0,
  onSelect,
  onLike,
  onDetail,
  onLocate,
}: PlaceCardProps) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect?.()}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "flex gap-[14px] p-[14px] border rounded-2xl cursor-pointer transition-all duration-500 ease-outquint",
        selected
          ? "border-verde-400 bg-verde-50"
          : "border-ink/5 bg-white hover:border-verde-300 hover:shadow-soft",
      )}
    >
      {/* Thumbnail. Antes el emoji de la categoría a 28 px, que en Windows y en
          Android se dibuja distinto; ahora el mismo icono del pin. */}
      <div className="recommendation-place-thumb size-16 rounded-xl shrink-0 grid place-items-center bg-gradient-to-br from-verde-50 to-verde-100">
        <CategoryIcon icon={icon} size={30} strokeWidth={1.6} className="text-verde-600" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-lv-display text-body font-semibold tracking-[-0.01em] text-ink truncate">
          {name}
        </div>
        <div className="text-small text-ink-soft/75 mb-[6px]">
          {category}
        </div>
        <div className="flex items-center gap-gap-xs flex-wrap">
          {rating > 0 && (
            <span className="inline-flex items-center gap-[3px] font-lv-display text-meta font-semibold text-verde-600">
              <Star size={12} fill="currentColor" />
              {rating}
            </span>
          )}
          <span className="font-lv-display text-meta text-ink-soft/75">
            {distance}
          </span>
          <span className="font-lv-display text-meta text-ink-soft/75">
            {price}
          </span>
        </div>
        {tags.length > 0 && (
          <div className="flex gap-[4px] flex-wrap mt-[6px]">
            {tags.map((tag) => (
              <span
                key={tag.label}
                className={cn(
                  "font-lv-display text-[11px] font-medium px-2 py-[2px] rounded-full",
                  tagStyles[tag.variant ?? "default"],
                )}
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col justify-between items-end shrink-0">
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={(e) => {
            e.stopPropagation();
            onLocate?.();
          }}
          className="size-10 rounded-full grid place-items-center text-ink-soft/75 transition-colors duration-500 hover:bg-verde-50 hover:text-verde-600"
          aria-label="Ver en el mapa"
          title="Ver en el mapa"
        >
          <MapPin size={16} strokeWidth={1.8} />
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 1.35 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
          onClick={(e) => {
            e.stopPropagation();
            onLike?.();
          }}
          className={cn(
            "size-10 rounded-full grid place-items-center transition-colors duration-500",
            liked
              ? "text-verde-600"
              : "text-ink-soft/75 hover:bg-verde-50 hover:text-verde-600",
          )}
          aria-label="Favorito"
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} strokeWidth={1.8} />
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={(e) => {
            e.stopPropagation();
            onDetail?.();
          }}
          className="size-10 rounded-full grid place-items-center text-ink-soft/75 transition-colors duration-500 hover:bg-verde-50 hover:text-verde-600"
          aria-label="Ver detalle"
        >
          <ArrowRight size={16} strokeWidth={1.8} />
        </motion.button>
      </div>
    </motion.div>
  );
}
