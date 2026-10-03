"use client";

import { type ReactNode } from "react";
import { LocationPicker } from "@/components/onboarding/location-picker";
import { ProvinceMap } from "@/components/onboarding/province-map";

/**
 * El cuerpo del paso «¿Dónde estás?».
 *
 * Estaba escrito en línea dentro de `onboarding/page.tsx` y ahora lo comparten
 * los dos caminos: el de usuario normal, donde es el paso 0 de siempre, y el del
 * negocio, donde es la primera pantalla del asistente. El texto y los controles
 * son los mismos; lo único que cambia es el envoltorio de entrada.
 *
 * `layer` recibe cada capa con su retardo: el onboarding de usuario pasa
 * `SlideContent` —que da el fundido escalonado de 50/100/150…— y el asistente no
 * pasa nada, y las capas salen planas.
 */
interface LocationScreenProps {
  location: string;
  onSelect: (value: string) => void;
  gpsDetected: boolean;
  /** Nombre de la provincia detectada por GPS, si la hubo. */
  gpsLabel?: string;
  onUseGPS: () => void;
  layer?: (content: ReactNode, delay: number) => ReactNode;
}

const plain = (content: ReactNode) => content;

export function LocationScreen({
  location,
  onSelect,
  gpsDetected,
  gpsLabel,
  onUseGPS,
  layer = plain,
}: LocationScreenProps) {
  return (
    <>
      {layer(
        <div className="size-16 rounded-2xl bg-verde-50 flex items-center justify-center mb-6 flex-shrink-0 mt-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-8 text-verde-700"
          >
            <path d="M12 2a8 8 0 0 0-8 8c0 4.42 8 12 8 12s8-7.58 8-12a8 8 0 0 0-8-8z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>,
        50,
      )}
      {layer(
        <h1 className="font-lv-display text-h2 font-bold leading-tight tracking-[-0.02em] text-ink mb-1">
          ¿Dónde estás?
        </h1>,
        100,
      )}
      {layer(
        <p className="text-ink-soft/75 text-body leading-relaxed mb-6">
          Para recomendarte lugares cerca de ti, cuéntanos en qué zona de Cuba
          te encuentras.
        </p>,
        150,
      )}
      {layer(<ProvinceMap location={location} />, 200)}
      {layer(
        <LocationPicker
          selected={location}
          onSelect={onSelect}
          gpsDetected={gpsDetected}
          gpsLabel={gpsLabel}
          onUseGPS={onUseGPS}
        />,
        250,
      )}
    </>
  );
}
