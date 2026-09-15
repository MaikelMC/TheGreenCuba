"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";

/* Solo Santiago de Cuba está cubierta. El resto lleva la etiqueta y queda sin
   poder elegirse: marcar algo como «próximamente» y dejar que se seleccione
   sería una promesa falsa. */
const locations = [
  { value: "la-habana", label: "La Habana", sub: "Vedado, Centro Habana, Miramar", soon: true },
  { value: "santiago", label: "Santiago de Cuba", sub: "Centro, Vista Alegre", soon: false },
  { value: "varadero", label: "Varadero", sub: "Península de Hicacos", soon: true },
  { value: "otra", label: "Otra ciudad", sub: "Matanzas, Trinidad, Santa Clara...", soon: true },
] as const;

interface LocationPickerProps {
  selected: string;
  onSelect: (value: string) => void;
  gpsDetected?: boolean;
  /** Nombre de la ciudad detectada por GPS (se muestra junto al check). */
  gpsLabel?: string;
  onUseGPS: () => void;
}

function LocationOption({
  selected,
  label,
  sublabel,
  soon,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  selected: boolean;
  label: string;
  sublabel: string;
  soon?: boolean;
}) {
  return (
    <button
      disabled={soon}
      className={cn(
        "flex items-center gap-4 p-4 border rounded-2xl shadow-soft transition-all duration-500 ease-outquint text-left w-full",
        soon
          ? "border-ink/5 bg-white cursor-not-allowed"
          : selected
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
      <div className="flex-1">
        <div className="font-lv-display text-body font-semibold text-ink">{label}</div>
        <div className="text-meta text-ink-soft/75">{sublabel}</div>
      </div>
      {soon && (
        <span className="shrink-0 rounded-full bg-sand-deep px-2.5 py-1 font-lv-display text-[11px] font-semibold text-ink-soft/75">
          In coming
        </span>
      )}
    </button>
  );
}

export function LocationPicker({ selected, onSelect, gpsDetected, gpsLabel, onUseGPS }: LocationPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      {locations.map((loc) => (
        <LocationOption
          key={loc.value}
          selected={selected === loc.value}
          soon={loc.soon}
          label={loc.label}
          sublabel={loc.sub}
          onClick={() => onSelect(loc.value)}
        />
      ))}

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
