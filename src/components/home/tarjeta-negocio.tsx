"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/admin/category-icon";
import { unirPartes } from "@/lib/texto-lugar";

interface NegocioTarjeta {
  id: string;
  name: string;
  category: string;
  barrio: string;
  icon: string;
  logoUrl?: string;
  abierto: boolean | null;
  estadoTexto: string | null;
  distance: string;
  ofertaTexto: string | null;
  topDelMes?: boolean;
  domicilio: boolean;
  planta: boolean;
  aceptaCup: boolean;
}

/**
 * La tarjeta del negocio, anclada abajo en lugar de la hoja.
 *
 * El contenido (logo, nombre, tipo, estado y chips) es un enlace a la ficha.
 * El corazón, la X y las acciones quedan fuera del enlace para que ningún toque
 * haga dos cosas a la vez. El gesto horizontal cambia de negocio; el vertical
 * hacia arriba abre la ficha.
 */
export function TarjetaNegocio({
  place,
  liked,
  posicion,
  total,
  primaryLabel,
  onLike,
  onClose,
  onPrev,
  onNext,
  onPrimary,
  onOpen,
}: {
  place: NegocioTarjeta;
  liked: boolean;
  posicion: number;
  total: number;
  primaryLabel: string;
  onLike: () => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPrimary: () => void;
  onOpen: () => void;
}) {
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const deslizado = useRef(false);

  const chips: { label: string; tono: "oferta" | "verde" }[] = [];
  if (place.ofertaTexto) {
    chips.push({ label: `Oferta: ${place.ofertaTexto}`, tono: "oferta" });
  }
  if (place.topDelMes) chips.push({ label: "Top del mes", tono: "oferta" });
  if (place.domicilio) chips.push({ label: "A domicilio", tono: "verde" });
  if (place.planta) chips.push({ label: "Tiene planta", tono: "verde" });
  if (place.aceptaCup) chips.push({ label: "Acepta CUP", tono: "verde" });

  const estado = unirPartes([place.estadoTexto, place.distance]);

  return (
    <motion.div
      role="dialog"
      aria-modal="false"
      aria-label={place.name}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      onPointerDown={(evento) => {
        if (
          (evento.target as HTMLElement).closest(
            "button, [data-no-swipe]",
          )
        ) {
          return;
        }
        deslizado.current = false;
        inicio.current = { x: evento.clientX, y: evento.clientY };
        try {
          evento.currentTarget.setPointerCapture(evento.pointerId);
        } catch {
          /* Sin captura el gesto sigue dentro de la tarjeta. */
        }
      }}
      onPointerUp={(evento) => {
        const desde = inicio.current;
        inicio.current = null;
        if (!desde) return;
        const dx = evento.clientX - desde.x;
        const dy = evento.clientY - desde.y;
        if (Math.abs(dy) > Math.abs(dx) && dy < -60) {
          deslizado.current = true;
          onOpen();
          return;
        }
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
          deslizado.current = true;
          if (dx > 0) onPrev();
          else onNext();
        }
      }}
      onPointerCancel={() => {
        inicio.current = null;
      }}
      onClickCapture={(evento) => {
        if (!deslizado.current) return;
        evento.preventDefault();
        evento.stopPropagation();
        deslizado.current = false;
      }}
      className="fixed inset-x-0 bottom-0 z-[350] touch-none rounded-t-4xl border-t border-ink/5 bg-white pb-safe-bottom shadow-card"
    >
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-ink/15" />

      <div className="flex items-start gap-gap-xs p-3">
        <Link
          href={`/place/${place.id}`}
          className="flex min-w-0 flex-1 items-start gap-gap-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
        >
          {/* La marca, no la portada: la tarjeta responde al pin que se acaba
              de tocar y el logo identifica el negocio de un vistazo. La foto
              de fachada se sigue viendo al abrir la ficha. */}
          <span className="relative grid size-[92px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-ink/5 bg-verde-50 text-verde-700">
            {place.logoUrl ? (
              <Image
                src={place.logoUrl}
                alt=""
                width={92}
                height={92}
                sizes="92px"
                loading="lazy"
                fetchPriority="low"
                className="size-full object-cover"
              />
            ) : (
              <CategoryIcon icon={place.icon} size={34} strokeWidth={1.6} />
            )}
          </span>

          <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
            <span className="line-clamp-2 font-lv-display text-lg font-bold leading-[1.2] tracking-[-0.02em] text-ink">
              {place.name}
            </span>
            <span className="truncate text-meta text-ink-soft/75">
              {unirPartes([place.category, place.barrio])}
            </span>
            <span
              className={cn(
                "truncate text-meta font-semibold",
                place.abierto === true ? "text-verde-700" : "text-ink-soft/75",
              )}
            >
              {estado}
            </span>
            {chips.length > 0 && (
              <span className="mt-[3px] flex flex-wrap gap-[4px]">
                {chips.slice(0, 3).map((chip) => (
                  <span
                    key={chip.label}
                    className={cn(
                      "inline-flex h-[22px] max-w-full items-center truncate rounded-full px-2 font-lv-display text-[12px] font-medium leading-none",
                      chip.tono === "oferta"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-verde-50 text-verde-700",
                    )}
                  >
                    {chip.label}
                  </span>
                ))}
              </span>
            )}
          </span>
        </Link>

        <div className="flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={onLike}
            aria-pressed={liked}
            aria-label={
              liked
                ? `Quitar ${place.name} de favoritos`
                : `Guardar ${place.name} en favoritos`
            }
            className="grid size-11 place-items-center rounded-full transition-colors duration-300 hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
          >
            <Heart
              size={20}
              strokeWidth={1.8}
              aria-hidden
              fill={liked ? "currentColor" : "none"}
              className={liked ? "text-lv-red" : "text-ink-soft/60"}
            />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar tarjeta del negocio"
            className="grid size-11 place-items-center rounded-full bg-sand text-ink transition-colors duration-300 hover:bg-sand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-gap-xs px-3">
        <button
          type="button"
          onClick={onPrimary}
          className="inline-flex h-12 items-center justify-center rounded-full bg-verde-400 px-4 font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-colors duration-300 hover:bg-verde-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
        >
          {primaryLabel}
        </button>
        <Link
          href={`/place/${place.id}`}
          data-no-swipe
          className="inline-flex h-12 items-center justify-center rounded-full border border-ink/10 bg-white px-4 font-lv-display text-small font-semibold text-ink transition-colors duration-300 hover:border-verde-300 hover:bg-verde-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
        >
          Ver ficha
        </Link>
      </div>

      <div className="flex items-center justify-between gap-gap-xs px-3 pb-2 pt-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={total <= 1}
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 font-lv-display text-meta font-semibold text-verde-700 transition-colors duration-300 hover:bg-verde-50 disabled:opacity-40"
        >
          <ChevronLeft size={15} strokeWidth={1.8} aria-hidden />
          Anterior
        </button>
        <span className="text-center text-meta text-ink-soft/60">
          {posicion} de {total} · desliza para ver más
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={total <= 1}
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 font-lv-display text-meta font-semibold text-verde-700 transition-colors duration-300 hover:bg-verde-50 disabled:opacity-40"
        >
          Siguiente
          <ChevronRight size={15} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </motion.div>
  );
}
