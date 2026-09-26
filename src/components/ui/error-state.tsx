"use client";

import { useEffect } from "react";
import { RefreshCw, RotateCw, TriangleAlert } from "lucide-react";
import { StateView } from "./state-view";

/* Botones a pastilla del design system, escritos enteros y no con el
   `Button` primitivo: `twMerge` no conoce las claves propias del tema
   (`rounded-lv`, `font-lv-display`), así que un `className` de fuera no
   siempre gana sobre la base de `cva` y acaba decidiendo el orden de la
   hoja de estilos. */
const BTN =
  "inline-flex items-center justify-center gap-gap-xs h-11 px-gap-lg rounded-full font-lv-display text-small font-semibold whitespace-nowrap cursor-pointer transition-all duration-500 ease-outquint active:scale-[0.98]";
const BTN_PRIMARY = `${BTN} bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300`;
const BTN_OUTLINE = `${BTN} border border-ink/10 bg-white text-ink hover:border-verde-300 hover:bg-verde-50`;

export interface ErrorStateProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  className?: string;
}

/**
 * Cuerpo compartido de los `error.tsx` del App Router. Los tres boundaries
 * (raíz, (main) y admin) solo cambian el título y el alto del contenedor.
 */
export function ErrorState({
  error,
  reset,
  title = "Algo salió mal",
  description = "Ocurrió un error inesperado. Intenta de nuevo; si sigue igual, recarga la página.",
  className,
}: ErrorStateProps) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <StateView
      className={className}
      variant="error"
      icon={TriangleAlert}
      title={title}
      description={
        <>
          {description}
          {/* /70 y no /50: es texto real (el digest del error), no decoración,
              y a 11px necesita el 4.5:1 de WCAG 1.4.3 — /50 se queda en ~3.1. */}
          {error.digest ? (
            <span className="mt-gap-xs block font-lv-display text-[11px] tracking-[0.04em] text-ink-soft/70">
              Ref: {error.digest}
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          <button type="button" className={BTN_PRIMARY} onClick={reset}>
            <RefreshCw size={16} strokeWidth={1.8} />
            Reintentar
          </button>
          <button
            type="button"
            className={BTN_OUTLINE}
            onClick={() => window.location.reload()}
          >
            <RotateCw size={16} strokeWidth={1.8} />
            Recargar
          </button>
        </>
      }
    />
  );
}
