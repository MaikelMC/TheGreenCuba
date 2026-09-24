"use client";

import { cn } from "@/lib/utils";
import { Navigation, Clock, Eye, Music } from "lucide-react";

/**
 * Los filtros acumulables del mapa.
 *
 * Antes guardaban su propio `estado` y no salía de aquí: los chips se
 * encendían, se apagaban y no cambiaban ni un pin. Ahora es un componente
 * controlado —el estado vive en la pantalla, que es quien filtra— para que lo
 * que se ve encendido sea exactamente lo que se está aplicando.
 */
const FILTERS = [
  { value: "distancia", label: "Cercanos", icon: Navigation },
  { value: "abierto", label: "Abiertos ahora", icon: Clock },
  { value: "tranquilo", label: "Tranquilo", icon: Eye },
  { value: "musica", label: "Con música", icon: Music },
];

interface PlaceFiltersProps {
  active: ReadonlySet<string>;
  onToggle: (value: string) => void;
  /** Sin ubicación no se puede medir «cercanos». El chip se deshabilita en vez
      de encenderse y no hacer nada. */
  hasLocation: boolean;
  className?: string;
}

export function PlaceFilters({
  active,
  onToggle,
  hasLocation,
  className,
}: PlaceFiltersProps) {
  return (
    <div
      className={cn(
        "absolute top-[72px] left-0 right-0 z-20 overflow-x-auto scrollbar-hide flex gap-[6px] px-gutter",
        className,
      )}
    >
      {FILTERS.map((f) => {
        const Icon = f.icon;
        const isActive = active.has(f.value);
        const disabled = f.value === "distancia" && !hasLocation;

        return (
          <button
            key={f.value}
            type="button"
            onClick={() => onToggle(f.value)}
            disabled={disabled}
            aria-pressed={isActive}
            title={disabled ? "Necesita tu ubicación para poder filtrar" : undefined}
            className={cn(
              "shrink-0 inline-flex items-center gap-[6px] px-3 py-1.5 rounded-full border font-lv-display text-meta font-medium whitespace-nowrap transition-all duration-500 ease-outquint",
              isActive
                ? "border-verde-400 bg-verde-400 text-verde-950 shadow-soft"
                : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
              disabled && "opacity-40 cursor-not-allowed hover:border-ink/10 hover:bg-white hover:text-ink-soft/75",
            )}
          >
            <Icon size={13} strokeWidth={1.8} />
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
