"use client";

import { useEffect } from "react";
import { RefreshCw, RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "./button";
import { StateView } from "./state-view";

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
          {error.digest ? (
            <span className="mt-gap-xs block font-mono text-[11px] text-muted-foreground/70">
              Ref: {error.digest}
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          <Button className="gap-[6px]" onClick={reset}>
            <RefreshCw size={16} strokeWidth={2} />
            Reintentar
          </Button>
          <Button
            className="gap-[6px]"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            <RotateCw size={16} strokeWidth={2} />
            Recargar
          </Button>
        </>
      }
    />
  );
}
