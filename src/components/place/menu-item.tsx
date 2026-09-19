"use client";

import { motion } from "motion/react";
import { Image } from "lucide-react";
import { cn, currencyLabel } from "@/lib/utils";

interface MenuItemProps {
  name: string;
  description: string;
  price: number;
  currency: string;
  tag?: {
    label: string;
    variant: "popular" | "new" | "offer";
  };
  imageEmoji?: string;
  className?: string;
  index?: number;
}

/* Mismo mapa que `menu-item-editor` del panel de negocio: verde para lo
   destacado, arena para el resto. Antes eran ámbar y rojo, que no existen en el
   sistema. */
const tagStyles: Record<string, string> = {
  popular: "bg-verde-100 text-verde-700",
  new: "bg-verde-50 text-verde-600",
  offer: "bg-sand-deep text-ink-soft/75",
};

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
                tagStyles[tag.variant],
              )}
            >
              {tag.label}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
