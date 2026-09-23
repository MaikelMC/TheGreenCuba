"use client";

import { motion } from "motion/react";
import { Image } from "lucide-react";
import { cn, currencyLabel } from "@/lib/utils";

interface MenuItemProps {
  name: string;
  description: string;
  /** Texto libre, como lo escribió el dueño. Ver `UserPlaceMenuItem`. */
  price: string;
  currency: string;
  tag?: string;
  imageEmoji?: string;
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
  imageEmoji,
  className,
  index = 0,
}: MenuItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ x: 4 }}
      className={cn("flex gap-gap-md py-gap-md border-b border-ink/5 last:border-b-0", className)}
    >
      {/* Image placeholder */}
      <div className="size-[72px] rounded-2xl bg-sand-deep shrink-0 grid place-items-center overflow-hidden text-verde-600">
        {imageEmoji ? (
          <span className="text-[28px]">{imageEmoji}</span>
        ) : (
          <Image size={24} strokeWidth={1.8} className="opacity-50" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="font-lv-display text-small font-semibold text-ink mb-[2px]">
          {name}
        </div>
        <div className="text-meta text-ink-soft/75 leading-snug line-clamp-2">
          {description}
        </div>
        <div className="flex items-center justify-between mt-[6px]">
          <span className="font-lv-display text-small font-semibold text-ink">
            {price}{" "}
            <span className="font-lv-display text-meta font-normal text-ink-soft/75">
              {currencyLabel(currency)}
            </span>
          </span>
          {tag && (
            <span
              className={cn(
                "px-[8px] py-[2px] rounded-full font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em]",
                TAG_STYLES[tag] ?? TAG_FALLBACK,
              )}
            >
              {tag}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
