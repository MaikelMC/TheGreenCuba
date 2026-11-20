"use client";

import { cn } from "@/lib/utils";
import { useId, useState } from "react";
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
  onUseGPS: () => void | Promise<void>;
}

/* Radio nativo escondido dentro de la etiqueta, el mismo patrón que la sección
   de plan del alta. Antes era un `<button role="radio">`: se anunciaba como
   radio pero no se movía con flechas y cada provincia era una parada de Tab
   (16). El nativo da las flechas, una sola parada y el anuncio correcto. */
function LocationOption({
  name,
  value,
  selected,
  label,
  onSelect,
}: {
  name: string;
  value: string;
  selected: boolean;
  label: string;
  onSelect: (value: string) => void;
}) {
  return (
    <label
      className={cn(
        "relative flex min-h-12 cursor-pointer items-center gap-3 p-3 border rounded-2xl shadow-soft transition duration-500 ease-outquint focus-within:ring-2 focus-within:ring-verde-400/40",
        selected
          ? "border-verde-400 bg-verde-50"
          : "border-ink/5 bg-white hover:border-verde-300 hover:bg-verde-50",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "size-3 rounded-full border-2 flex-shrink-0 transition duration-500",
          selected
            ? "bg-verde-400 border-verde-400 ring-[3px] ring-verde-400/20"
            : "border-ink/20",
        )}
      />
      <span className="font-lv-display text-body font-semibold text-ink">{label}</span>
    </label>
  );
}

export function LocationPicker({ selected, onSelect, gpsDetected, gpsLabel, onUseGPS }: LocationPickerProps) {
  /* El GPS puede tardar segundos; sin esto el botón no daba señal de vida. */
  const [buscando, setBuscando] = useState(false);
  const radioName = useId();

  async function usarGPS() {
    if (buscando) return;
    setBuscando(true);
    try {
      await onUseGPS();
    } finally {
      setBuscando(false);
    }
  }

  return (
    /* El GPS va primero y la lista sigue el scroll del paso. Antes la lista
       tenía su propio scroll (`max-h-[42vh]`) dentro de un paso que también
       se desplaza: en un móvil de 667 px el dedo se atascaba entre los dos y
       el botón del GPS quedaba debajo del pliegue. */
    <div className="flex flex-col gap-3 pb-4">
      <button
        type="button"
        onClick={() => void usarGPS()}
        disabled={buscando}
        aria-busy={buscando}
        className={cn(
          "flex min-h-12 items-center justify-center gap-2 w-full py-3 border-2 rounded-full cursor-pointer font-lv-display text-small font-semibold transition duration-500 ease-outquint disabled:cursor-wait disabled:opacity-60",
          gpsDetected
            ? "border-solid border-verde-300 text-verde-600"
            : "border-dashed border-ink/10 text-ink-soft/75 hover:border-verde-300 hover:text-verde-600",
        )}
      >
        {buscando ? (
          "Buscando tu ubicación…"
        ) : gpsDetected ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Ubicación detectada: {gpsLabel ?? "tu zona"}
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-[18px]" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
            Usar mi ubicación actual
          </>
        )}
      </button>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="sr-only">Provincia</legend>
        {CUBA_PROVINCES.map((province) => (
          <LocationOption
            key={province.value}
            name={radioName}
            value={province.value}
            selected={selected === province.value}
            label={province.label}
            onSelect={onSelect}
          />
        ))}
      </fieldset>
    </div>
  );
}
