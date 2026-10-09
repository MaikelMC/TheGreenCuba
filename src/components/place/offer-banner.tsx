"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface OfferBannerProps {
  label: string;
  text: string;
  expiry: string;
  /**
   * Frase del dueño sobre la oferta. Opcional: la escribió él o no la escribió.
   */
  description?: string;
  /**
   * El precio de antes y el de ahora, ya con la moneda puesta.
   *
   * Opcional y puede faltar aunque la oferta exista —un producto sin precio que
   * se pueda leer como cifra, o una rebaja por porcentaje sobre «3–5 USD»—: en
   * ese caso la tarjeta se sostiene con el título y la fecha.
   */
  precio?: { de: string; por: string };
  visible?: boolean;
  className?: string;
}

export function OfferBanner({
  label,
  text,
  expiry,
  description,
  precio,
  visible = true,
  className,
}: OfferBannerProps) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 10 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={cn(
        "mx-gap-md mb-gap-md p-gap-md bg-verde-50 border border-verde-200 rounded-2xl",
        className,
      )}
    >
      <div className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600 mb-[6px]">
        {label}
      </div>
      <div className="font-lv-display text-small font-semibold text-ink leading-snug">
        {text}
      </div>
      {precio && (
        <div className="mt-[6px] flex items-baseline gap-gap-xs">
          <span className="font-lv-display text-meta text-ink-soft/60 line-through">
            {precio.de}
          </span>
          <span className="font-lv-display text-body font-semibold text-verde-600">
            {precio.por}
          </span>
        </div>
      )}
      {description && (
        <div className="mt-[6px] text-meta text-ink-soft/75">{description}</div>
      )}
      <div className="text-meta text-ink-soft/75 mt-[6px]">{expiry}</div>
    </motion.div>
  );
}
