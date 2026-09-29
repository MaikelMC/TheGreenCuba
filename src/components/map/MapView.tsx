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
      <div className="map-loading absolute inset-0 flex items-center justify-center bg-sand-deep">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-verde-400 border-t-transparent" />
          <span className="text-small text-ink-soft/75">Cargando mapa...</span>
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
        <div className="absolute inset-0 flex items-center justify-center bg-sand-deep">
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <span className="font-lv-display text-body font-semibold text-ink">
              No se pudo cargar el mapa
            </span>
            <span className="text-small text-ink-soft/75">
              Revisa tu conexión e inténtalo de nuevo.
            </span>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onRetry();
              }}
              className="rounded-full bg-verde-400 px-5 py-2.5 font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
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
  function MapView({ children, className, ...mapProps }, ref) {
    const [retryKey, setRetryKey] = useState(0);

    return (
      <div
        ref={ref}
        className={cn(
          "absolute inset-0",
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
