"use client";

import { motion } from "motion/react";
import { Clock, Sparkles, Tag } from "lucide-react";
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

/**
 * La oferta flash de la ficha.
 *
 * Es la primera cosa que debe verse al entrar al negocio, así que la tarjeta se
 * separa del resto sin salirse del sistema: fondo verde del tema, un filo de
 * color a la izquierda, dos halos suaves y un brillo que cruza una sola vez al
 * aparecer. Los adornos son `aria-hidden` y translúcidos, de modo que funcionan
 * igual sobre el fondo claro y el oscuro —los tokens `verde-50`, `verde-200` y
 * `white/60` ya tienen su pareja oscura en `globals.css`—.
 */
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
        "relative mx-gap-md mb-gap-md overflow-hidden rounded-2xl border border-verde-200 bg-verde-50 p-gap-md shadow-soft",
        className,
      )}
    >
      {/* Adornos. Van primero y detrás del contenido. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-3 left-0 w-[5px] rounded-r-full bg-verde-400"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-verde-400/20 blur-2xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -left-6 size-24 rounded-full bg-verde-300/20 blur-2xl"
      />
      <Sparkles
        aria-hidden
        size={44}
        strokeWidth={1.2}
        className="pointer-events-none absolute -right-1 -top-1 text-verde-600 opacity-20"
      />
      {/* El brillo cruza una vez al entrar; no se repite ni responde a nada. */}
      <motion.span
        aria-hidden
        initial={{ x: "-130%" }}
        whileInView={{ x: "160%" }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay: 0.2, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-white/30 blur-md"
      />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-gap-xs">
          <span className="inline-flex items-center gap-[6px] rounded-full bg-verde-400 px-[10px] py-[4px] font-lv-display text-[10px] font-bold uppercase tracking-[0.18em] text-verde-950 shadow-soft">
            <Tag size={12} strokeWidth={2.2} />
            {label}
          </span>
          <Sparkles
            size={14}
            strokeWidth={2}
            className="text-verde-600 opacity-60"
            aria-hidden
          />
        </div>

        <div className="mt-gap-sm break-words font-lv-display text-body font-bold leading-snug text-ink">
          {text}
        </div>

        {description && (
          <div className="mt-[6px] break-words text-meta text-ink-soft/75">
            {description}
          </div>
        )}

        {precio && (
          <div className="mt-gap-sm flex flex-wrap items-baseline gap-x-gap-sm gap-y-1 rounded-xl border border-dashed border-verde-300/60 bg-white/60 px-gap-sm py-2">
            <span className="font-lv-display text-meta text-ink-soft/60 line-through">
              {precio.de}
            </span>
            <span className="font-lv-display text-[20px] font-bold leading-none text-verde-600">
              {precio.por}
            </span>
          </div>
        )}

        <div className="mt-gap-sm flex items-center gap-[6px] border-t border-dashed border-verde-300/50 pt-gap-xs text-[11px] font-medium text-ink-soft/75">
          <Clock size={12} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="min-w-0">{expiry}</span>
        </div>
      </div>
    </motion.div>
  );
}
