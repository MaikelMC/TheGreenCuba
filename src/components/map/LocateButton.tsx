"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getCurrentPosition, GEO_ERROR_MESSAGES } from "@/lib/map/geolocation";
import { GEO_ZOOM } from "@/lib/map/map-config";
import type { LocateState } from "./types";

interface LocateButtonProps {
  onUserLocated?: (lat: number, lng: number, accuracy?: number) => void;
  onLocateStateChange?: (state: LocateState) => void;
}

export const LocateButton = memo(function LocateButton({
  onUserLocated,
  onLocateStateChange,
}: LocateButtonProps) {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  // Parpadeo verde al encontrar la ubicación. Es puramente visual: el padre ya
  // se entera del resultado vía onLocateStateChange.
  const [done, setDone] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El GPS puede tardar hasta 10 s. Si el usuario navega en ese hueco, el mapa
  // ya está destruido y `map.flyTo` reventaría con "_leaflet_pos" al animar un
  // pane retirado. Esta bandera corta el flujo al desmontar.
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, []);

  async function handleClick() {
    if (locating) return;
    setLocating(true);
    setDone(false);
    onLocateStateChange?.("loading");
    try {
      const pos = await getCurrentPosition({ useCache: false });
      // Sin esto, el `setState` posterior avisa a React de un componente ya
      // desmontado y el `flyTo` anima sobre un mapa muerto.
      if (!alive.current) return;
      setLocating(false);
      setDone(true);
      if (doneTimer.current) clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setDone(false), 1200);
      onLocateStateChange?.("success");
      map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), GEO_ZOOM), {
        duration: 0.8,
      });
      onUserLocated?.(pos.lat, pos.lng, pos.accuracy);
    } catch (err) {
      if (!alive.current) return;
      setLocating(false);
      const code = (err as { code?: string }).code as
        | keyof typeof GEO_ERROR_MESSAGES
        | undefined;
      onLocateStateChange?.(code === "denied" ? "denied" : "error");
      toast.error(GEO_ERROR_MESSAGES[code ?? "unknown"] ?? GEO_ERROR_MESSAGES.unknown);
    }
  }

  // Misma caja y sombra que el control de zoom (ver --map-* en globals.css).
  const box =
    "flex size-[var(--map-ctrl-size)] items-center justify-center rounded-2xl border border-ink/5 bg-white shadow-soft";

  return (
    <div className="absolute left-2.5 z-[1000] bottom-[var(--map-locate-bottom)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={locating}
        aria-label="Ir a mi ubicación"
        aria-busy={locating}
        className={cn(
          box,
          "relative cursor-pointer transition-all duration-500 ease-outquint hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400 active:scale-95 disabled:cursor-wait",
          done
            ? "border-verde-400 bg-verde-50 text-verde-600 ring-4 ring-verde-400/20"
            : "text-ink",
        )}
      >
        {/* Onda de radar solo mientras busca. */}
        {locating && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl border border-verde-400 motion-safe:animate-ping"
          />
        )}
        {locating ? (
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-spin text-verde-600"
          >
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07-2.83 2.83M9.76 14.24l-2.83 2.83m0-10.14l2.83 2.83m4.48 4.48l2.83 2.83" />
          </svg>
        )}
      </button>
    </div>
  );
});
