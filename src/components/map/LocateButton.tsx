"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import { toast } from "sonner";
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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [locating, setLocating] = useState(false);

  // Position the button at the bottom-left corner, right above the zoom
  // control. Leaflet corner containers disable pointer events on children,
  // so we anchor it absolutely and offset it from the zoom control instead.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const updatePosition = () => {
      const zoomEl = document.querySelector(".leaflet-control-zoom");
      if (!zoomEl) {
        host.style.bottom = "88px";
        return;
      }
      const zoomTop = zoomEl.getBoundingClientRect().top;
      const offset = Math.max(12, Math.round(window.innerHeight - zoomTop + 12));
      host.style.bottom = `${offset}px`;
    };

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("lavverde:controls-offset", updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("lavverde:controls-offset", updatePosition);
    };
  }, [map]);

  async function handleClick() {
    if (locating) return;
    setLocating(true);
    onLocateStateChange?.("loading");
    try {
      const pos = await getCurrentPosition({ useCache: false });
      setLocating(false);
      onLocateStateChange?.("success");
      map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), GEO_ZOOM), {
        duration: 0.8,
      });
      onUserLocated?.(pos.lat, pos.lng, pos.accuracy);
    } catch (err) {
      setLocating(false);
      const code = (err as { code?: string }).code as
        | keyof typeof GEO_ERROR_MESSAGES
        | undefined;
      onLocateStateChange?.(code === "denied" ? "denied" : "error");
      toast.error(GEO_ERROR_MESSAGES[code ?? "unknown"] ?? GEO_ERROR_MESSAGES.unknown);
    }
  }

  return (
    <div ref={hostRef} className="absolute left-2.5 z-[1000]">
      <button
        type="button"
        onClick={handleClick}
        disabled={locating}
        aria-label="Ir a mi ubicación"
        aria-busy={locating}
        className="flex size-10 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-foreground shadow-lv-sm transition-all hover:bg-background hover:shadow-lv-md disabled:cursor-wait disabled:opacity-60"
      >
        {locating ? (
          <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
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
