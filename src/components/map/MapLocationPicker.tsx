"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useCallback } from "react";
import { Crosshair, MapPin, Search, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CUBA_AREAS } from "@/lib/map/cuba-areas";
import { getCurrentPosition, GEO_ERROR_MESSAGES, type GeolocationErrorCode } from "@/lib/map/geolocation";
import { validatePlaceCoordinates } from "@/lib/map/coordinates";

const PickerMap = dynamic(
  () =>
    import("./MapLocationPickerMap").then((m) => ({
      default: m.MapLocationPickerMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full grid place-items-center bg-[oklch(92%_0.008_85)]">
        <span className="text-[13px] text-muted-foreground">Cargando mapa...</span>
      </div>
    ),
  },
);

export interface LocationPoint {
  lat: number;
  lng: number;
}

interface MapLocationPickerProps {
  value: LocationPoint | null;
  onChange: (point: LocationPoint | null) => void;
  className?: string;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function MapLocationPicker({
  value,
  onChange,
  className,
}: MapLocationPickerProps) {
  const [areaQuery, setAreaQuery] = useState("");
  const [flyTarget, setFlyTarget] = useState<LocationPoint | null>(null);
  const [locateBusy, setLocateBusy] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const filteredAreas = useMemo(() => {
    const q = normalize(areaQuery.trim());
    if (!q) return CUBA_AREAS;
    return CUBA_AREAS.filter((area) =>
      normalize(`${area.name} ${area.province}`).includes(q),
    );
  }, [areaQuery]);

  const handleSelectArea = useCallback(
    (lat: number, lng: number) => {
      setFlyTarget({ lat, lng });
      onChange({ lat, lng });
      setAreaQuery("");
    },
    [onChange],
  );

  const handleLocate = useCallback(() => {
    setLocateBusy(true);
    setLocateError(null);
    getCurrentPosition({ useCache: false })
      .then((pos) => {
        setFlyTarget({ lat: pos.lat, lng: pos.lng });
        const validation = validatePlaceCoordinates(pos.lat, pos.lng);
        if (validation.valid) {
          onChange({ lat: pos.lat, lng: pos.lng });
        } else {
          setLocateError(
            "Tu ubicación GPS está fuera de Cuba o en el mar. Mueve el pin a un punto en tierra.",
          );
        }
      })
      .catch((err) => {
        const code = (err as { code?: GeolocationErrorCode }).code;
        setLocateError(
          code ? GEO_ERROR_MESSAGES[code] : "No se pudo obtener tu ubicación.",
        );
      })
      .finally(() => setLocateBusy(false));
  }, [onChange]);

  return (
    <div className={cn("flex flex-col gap-gap-sm", className)}>
      {/* Map */}
      <div className="relative h-[320px] lg:h-[380px] rounded-lv-lg overflow-hidden border border-border">
        <PickerMap value={value} onPointChange={onChange} flyTarget={flyTarget} />

        {/* Hint */}
        <div className="absolute top-gap-sm left-gap-sm z-[500] pointer-events-none max-w-[70%]">
          <div className="inline-flex items-center gap-[6px] px-3 py-[6px] rounded-full bg-surface/95 backdrop-blur border border-border shadow-lv-sm text-[12px] font-medium text-foreground">
            <MapPin size={14} className="text-accent shrink-0" />
            Toca el mapa para colocar el pin
          </div>
        </div>

        {/* Locate button */}
        <button
          type="button"
          onClick={handleLocate}
          disabled={locateBusy}
          className="absolute top-gap-sm right-gap-sm z-[500] inline-flex items-center gap-[6px] px-3 py-[7px] rounded-full bg-surface/95 backdrop-blur border border-border shadow-lv-sm text-[12px] font-medium text-foreground hover:border-accent hover:text-accent transition-all disabled:opacity-60"
        >
          <Crosshair size={14} className={cn(locateBusy && "animate-spin")} />
          {locateBusy ? "Ubicando..." : "Mi ubicación"}
        </button>
      </div>

      {/* Locate error */}
      {locateError && (
        <div className="px-3 py-[7px] rounded-lv-lg bg-destructive/10 border border-destructive/25 text-[12px] text-destructive font-medium">
          {locateError}
        </div>
      )}

      {/* Coordinates readout */}
      <div className="flex items-center justify-between gap-gap-sm px-1">
        <span className="text-meta text-muted-foreground flex items-center gap-[6px]">
          <MapPin size={13} className="text-accent" />
          {value
            ? `${value.lat.toFixed(4)}° N, ${Math.abs(value.lng).toFixed(4)}° O`
            : "Sin punto seleccionado"}
        </span>
        {value && (
          <span className="inline-flex items-center gap-[4px] font-mono text-[11px] font-medium text-lv-teal">
            <CheckCircle2 size={13} />
            Punto válido en Cuba
          </span>
        )}
      </div>

      {/* Zone quick-jump */}
      <div className="bg-surface border border-border rounded-lv-lg overflow-hidden">
        <div className="p-gap-sm border-b border-border">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
              placeholder="Buscar ciudad o zona de Cuba..."
              className="w-full h-[38px] pl-9 pr-3 rounded-lv bg-muted border border-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-[6px] p-gap-sm max-h-[132px] overflow-y-auto">
          {filteredAreas.length === 0 && (
            <span className="text-meta text-muted-foreground px-1">
              No se encontraron zonas.
            </span>
          )}
          {filteredAreas.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => handleSelectArea(area.lat, area.lng)}
              className="px-3 py-[6px] rounded-full border border-border text-[12px] font-medium text-foreground bg-background hover:border-accent hover:text-accent transition-all"
            >
              {area.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
