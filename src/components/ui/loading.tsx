import * as React from "react";
import { cn } from "@/lib/utils";

const SPINNER_SIZES = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
} as const;

type SpinnerSize = keyof typeof SPINNER_SIZES;

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
}

/**
 * El spinner circular que ya se repetía en el mapa y los buscadores.
 * Por defecto hereda el color de acción del sistema (`verde-400`); pasa
 * `className` para otro color.
 */
const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, size = "md", ...props }, ref) => (
    <span
      ref={ref}
      role="status"
      aria-label="Cargando"
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-2 border-verde-400 border-t-transparent",
        SPINNER_SIZES[size],
        className,
      )}
      {...props}
    />
  ),
);
Spinner.displayName = "Spinner";

/** Bloque gris pulsante. Se le da forma (alto/ancho/radio) con `className`. */
const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden
      className={cn("animate-pulse rounded-2xl bg-sand-deep", className)}
      {...props}
    />
  ),
);
Skeleton.displayName = "Skeleton";

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string | null;
  size?: SpinnerSize;
}

/**
 * Área centrada con spinner y etiqueta. Para `loading.tsx` y cargas de sección.
 * `label={null}` deja solo el spinner (útil dentro de botones o tarjetas).
 */
const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ className, label = "Cargando…", size = "md", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center gap-gap-sm py-gap-xl text-center",
        className,
      )}
      {...props}
    >
      <Spinner size={size} />
      {label ? (
        <span className="font-lv-display text-meta text-ink-soft/75">{label}</span>
      ) : null}
    </div>
  ),
);
LoadingState.displayName = "LoadingState";

export { Spinner, Skeleton, LoadingState };
