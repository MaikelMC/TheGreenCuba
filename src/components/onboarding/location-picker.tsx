"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";
import { CUBA_PROVINCES } from "@/lib/user-preferences-store";

/* Las 16 provincias del país, de `CUBA_PROVINCES`: la misma lista que usa el
   selector provincial del perfil y la que sabe centrar el mapa en cada una.

   Antes eran tres opciones escritas a mano —La Habana, Varadero, «Otra
   ciudad»— y **las tres deshabilitadas** con un sello «In coming». El paso no
   dejaba elegir nada: quien no tenía GPS se quedaba en «otra» y el mapa caía
   siempre en La Habana.

   No se fuerza provincia por defecto. Si el usuario ya estaba ubicado o el GPS
   lo marcó antes, ese valor se mantiene; si no, queda el estado neutro «otra». */

interface LocationPickerProps {
  selected: string;
  onSelect: (value: string) => void;
  gpsDetected?: boolean;
  /** Nombre de la provincia detectada por GPS (se muestra junto al check). */
  gpsLabel?: string;
  onUseGPS: () => void;
}

function LocationOption({
  selected,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  selected: boolean;
  label: string;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      className={cn(
        "flex items-center gap-3 p-3 border rounded-2xl shadow-soft transition-all duration-500 ease-outquint text-left w-full",
        selected
          ? "border-verde-400 bg-verde-50"
          : "border-ink/5 bg-white hover:border-verde-300 hover:bg-verde-50",
      )}
      {...props}
    >
      <span
        className={cn(
          "size-3 rounded-full border-2 flex-shrink-0 transition-all duration-500",
          selected
            ? "bg-verde-400 border-verde-400 ring-[3px] ring-verde-400/20"
            : "border-ink/20",
        )}
      />
      <span className="font-lv-display text-body font-semibold text-ink">{label}</span>
    </button>
  );
}

export function LocationPicker({ selected, onSelect, gpsDetected, gpsLabel, onUseGPS }: LocationPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Dieciséis provincias no caben de una vez en la pantalla del móvil, así
          que la lista se desplaza dentro del paso y el botón del GPS —que es la
          otra forma de responder— se queda a la vista. */}
      <div
        role="radiogroup"
        aria-label="Provincia"
        className="flex flex-col gap-2 max-h-[42vh] overflow-y-auto pr-1 -mr-1"
      >
        {CUBA_PROVINCES.map((province) => (
          <LocationOption
            key={province.value}
            selected={selected === province.value}
            label={province.label}
            onClick={() => onSelect(province.value)}
          />
        ))}
      </div>

      <button
        onClick={onUseGPS}
        className={cn(
          "flex items-center justify-center gap-2 w-full py-3 border-2 rounded-full cursor-pointer font-lv-display text-small font-semibold transition-all duration-500 ease-outquint mt-1",
          gpsDetected
            ? "border-solid border-verde-300 text-verde-600"
            : "border-dashed border-ink/10 text-ink-soft/75 hover:border-verde-300 hover:text-verde-600",
        )}
      >
        {gpsDetected ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Ubicación detectada: {gpsLabel ?? "tu zona"}
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
            Usar mi ubicación actual
          </>
        )}
      </button>
    </div>
  );
}
