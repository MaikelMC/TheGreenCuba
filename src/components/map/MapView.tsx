"use client";

import dynamic from "next/dynamic";
import { forwardRef, useState, Component, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { MapViewProps } from "./types";

const MapContent = dynamic(
  () => import("./MapContent").then((mod) => ({ default: mod.MapContent })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-[oklch(92%_0.008_85)]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-[13px] text-muted-foreground">Cargando mapa...</span>
        </div>
      </div>
    ),
  },
);

class MapErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {}

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-[oklch(92%_0.008_85)]">
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <span className="text-[14px] font-semibold text-foreground">
              No se pudo cargar el mapa
            </span>
            <span className="text-[13px] text-muted-foreground">
              Revisa tu conexión e inténtalo de nuevo.
            </span>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onRetry();
              }}
              className="rounded-lv bg-accent px-4 py-2 font-display text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const MapView = forwardRef<HTMLDivElement, MapViewProps>(
  function MapView({ children, className, searching, ...mapProps }, ref) {
    const [retryKey, setRetryKey] = useState(0);

    return (
      <div
        ref={ref}
        className={cn(
          "absolute inset-0",
          searching && "map-markers-searching",
          className,
        )}
      >
        <MapErrorBoundary onRetry={() => setRetryKey((k) => k + 1)}>
          <MapContent key={retryKey} {...mapProps} />
        </MapErrorBoundary>
        {children}
      </div>
    );
  },
);
