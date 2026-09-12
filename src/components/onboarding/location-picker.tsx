"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";

const locations = [
  { value: "la-habana", label: "La Habana", sub: "Vedado, Centro Habana, Miramar" },
  { value: "santiago", label: "Santiago de Cuba", sub: "Centro, Vista Alegre" },
  { value: "varadero", label: "Varadero", sub: "Península de Hicacos" },
  { value: "otra", label: "Otra ciudad", sub: "Matanzas, Trinidad, Santa Clara..." },
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
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean; label: string; sublabel: string }) {
  return (
    <button
      className={cn(
        "flex items-center gap-4 p-4 border-[1.5px] rounded-lv-lg transition-all duration-200 text-left w-full",
        selected ? "border-accent bg-accent/10" : "border-border hover:border-accent hover:bg-accent/10",
      )}
      {...props}
    >
      <span
        className={cn(
          "size-3 rounded-full border-2 flex-shrink-0 transition-all duration-200",
          selected
            ? "bg-accent border-accent shadow-[0_0_0_3px] shadow-accent/10"
            : "border-border",
        )}
      />
      <div>
        <div className="font-display text-body font-semibold">{label}</div>
        <div className="font-mono text-meta text-muted-foreground">{sublabel}</div>
      </div>
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
          label={loc.label}
          sublabel={loc.sub}
          onClick={() => onSelect(loc.value)}
        />
      ))}

      <button
        onClick={onUseGPS}
        className={cn(
          "flex items-center justify-center gap-2 w-full py-3.5 border-2 rounded-lv-lg cursor-pointer font-body text-small font-semibold transition-all duration-200 mt-1",
          gpsDetected
            ? "border-accent text-accent border-solid"
            : "border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent",
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
