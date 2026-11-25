"use client";

import { clsx } from "clsx";

export interface OpcionSegmentado<T extends string> {
  valor: T;
  etiqueta: string;
  contador?: number;
}

/**
 * Control segmentado: dos o tres opciones excluyentes, sin desplegable.
 *
 * El estado lo lleva quien lo usa —la URL en las secciones, `useState` en una
 * hoja—. Cada botón conserva 44 px de alto en móvil y se anuncia como pulsado
 * con `aria-pressed`, que es lo que lee el lector de pantalla.
 */
export function ControlSegmentado<T extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
  className,
}: {
  opciones: OpcionSegmentado<T>[];
  valor: T;
  onCambio: (valor: T) => void;
  etiqueta: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={clsx(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-ink/10 bg-sand p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {opciones.map((opcion) => {
        const activo = opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambio(opcion.valor)}
            className={clsx(
              "flex min-h-9 shrink-0 items-center gap-gap-xs rounded-full px-gap-sm font-lv-display text-meta font-semibold transition-colors duration-300 ease-outquint max-sm:min-h-11",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
              activo
                ? "bg-white text-verde-700 shadow-lv-xs"
                : "text-ink-soft/75 hover:text-ink",
            )}
          >
            {opcion.etiqueta}
            {opcion.contador !== undefined && (
              <span
                className={clsx(
                  "min-w-[18px] rounded-full px-[5px] text-center text-[11px] leading-[18px]",
                  activo
                    ? "bg-verde-50 text-verde-700"
                    : "bg-ink/5 text-ink-soft/75",
                )}
              >
                {opcion.contador}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
