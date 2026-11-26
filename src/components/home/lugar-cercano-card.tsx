"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/admin/category-icon";
import { unirPartes } from "@/lib/texto-lugar";

interface LugarCercano {
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
 * La tarjeta compacta de «Cerca de ti».
 *
 * 52 px de logo, nombre y corazón, tipo y barrio, estado con distancia y hasta
 * dos motivos reales (oferta, top, domicilio, planta o CUP). No inventa nada:
 * los chips salen de los mismos datos que la ficha.
 */
export function LugarCercanoCard({
  place,
  liked,
  selected,
  onLike,
  onSelect,
}: {
  place: LugarCercano;
  liked: boolean;
  selected?: boolean;
  onLike: () => void;
  onSelect: () => void;
}) {
  const chips: { label: string; tono: "oferta" | "verde" }[] = [];
  if (place.ofertaTexto) {
    chips.push({ label: `Oferta: ${place.ofertaTexto}`, tono: "oferta" });
  }
  if (place.topDelMes) chips.push({ label: "Top del mes", tono: "oferta" });
  if (place.domicilio) chips.push({ label: "A domicilio", tono: "verde" });
  if (place.planta) chips.push({ label: "Tiene planta", tono: "verde" });
  if (place.aceptaCup) chips.push({ label: "Acepta CUP", tono: "verde" });

  const estado = unirPartes([place.estadoTexto, place.distance]);
  const abierto = place.abierto === true;

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-2xl border bg-white p-1 pl-3 transition-colors duration-300",
        selected
          ? "border-verde-400 bg-verde-50"
          : "border-ink/5 hover:border-verde-300",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Ver ${place.name} en el mapa`}
        className="flex min-w-0 flex-1 items-center gap-gap-sm py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
      >
        <span className="grid size-[52px] shrink-0 place-items-center overflow-hidden rounded-lv-lg border border-ink/5 bg-verde-50 text-verde-700">
          {place.logoUrl ? (
            <Image
              src={place.logoUrl}
              alt=""
              width={52}
              height={52}
              sizes="52px"
              loading="lazy"
              fetchPriority="low"
              className="size-full object-cover"
            />
          ) : (
            <CategoryIcon icon={place.icon} size={24} strokeWidth={1.7} />
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-[1px]">
          <span className="truncate font-lv-display text-[16px] font-semibold leading-6 tracking-[-0.01em] text-ink">
            {place.name}
          </span>
          <span className="truncate text-meta leading-snug text-ink-soft/75">
            {unirPartes([place.category, place.barrio])}
          </span>
          <span
            className={cn(
              "truncate text-meta font-semibold leading-snug",
              abierto ? "text-verde-700" : "text-ink-soft/75",
            )}
          >
            {estado}
          </span>
          {chips.length > 0 && (
            <span className="mt-[3px] flex gap-[4px] overflow-hidden">
              {chips.slice(0, 2).map((chip) => (
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
      </button>

      <button
        type="button"
        onClick={onLike}
        aria-pressed={liked}
        aria-label={
          liked
            ? `Quitar ${place.name} de favoritos`
            : `Guardar ${place.name} en favoritos`
        }
        className="grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-300 hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
      >
        <Heart
          size={20}
          strokeWidth={1.8}
          aria-hidden
          fill={liked ? "currentColor" : "none"}
          className={liked ? "text-lv-red" : "text-ink-soft/60"}
        />
      </button>
    </div>
  );
}
