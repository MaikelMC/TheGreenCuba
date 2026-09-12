"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Crosshair, MapPin, Search, CheckCircle2, Loader2, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { CUBA_AREAS } from "@/lib/map/cuba-areas";
import { getCurrentPosition, GEO_ERROR_MESSAGES, type GeolocationErrorCode } from "@/lib/map/geolocation";
import { validatePlaceCoordinates } from "@/lib/map/coordinates";
import {
  searchAddress,
  reverseGeocode,
  type GeocodeSuggestion,
  type ResolvedLocation,
} from "@/lib/map/geocode";

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
  /** Se llama cuando se detecta la dirección del punto (búsqueda o reverse). */
  onResolved?: (resolved: ResolvedLocation | null) => void;
  className?: string;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function suggestionToResolved(s: GeocodeSuggestion): ResolvedLocation {
  const streetParts = [s.street, s.housenumber].filter(Boolean).join(" ");
  const between = s.between ? `e/ ${s.between}` : "";
  const base = [streetParts, s.between ? between : "", s.district].filter(Boolean);
  return {
    address: base.join(", "),
    barrio: s.district ?? s.city ?? "",
    label: [streetParts || s.district, s.city].filter(Boolean).join(" · "),
  };
}

export function MapLocationPicker({
  value,
  onChange,
  onResolved,
  className,
}: MapLocationPickerProps) {
  const [areaQuery, setAreaQuery] = useState("");
  const [flyTarget, setFlyTarget] = useState<LocationPoint | null>(null);
  const [flyZoom, setFlyZoom] = useState(13);
  const [locateBusy, setLocateBusy] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Búsqueda de direcciones (Photon).
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [searchingAddr, setSearchingAddr] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [resolved, setResolved] = useState<ResolvedLocation | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseSeq = useRef(0);

  // Cancela timers al desmontar.
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      reverseSeq.current++;
    };
  }, []);

  const runReverse = useCallback(
    (lat: number, lng: number) => {
      const seq = ++reverseSeq.current;
      reverseGeocode(lat, lng)
        .then((r) => {
          if (seq !== reverseSeq.current) return; // respuesta vieja
          setResolved(r);
          onResolved?.(r);
        })
        .catch(() => {
          if (seq !== reverseSeq.current) return;
          setResolved(null);
        });
    },
    [onResolved],
  );

  // Punto elegido por toque/arrastre del mapa → confirma calle con Nominatim.
  const handleMapPoint = useCallback(
    (point: LocationPoint | null) => {
      if (!point) return;
      onChange(point);
      runReverse(point.lat, point.lng);
    },
    [onChange, runReverse],
  );

  const handleSelectSuggestion = useCallback(
    (s: GeocodeSuggestion) => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      setShowSuggestions(false);
      setSearchingAddr(false);
      setAddressQuery(s.label);
      setFlyTarget({ lat: s.lat, lng: s.lng });
      setFlyZoom(17); // acercar a nivel calle para verificar el punto
      onChange({ lat: s.lat, lng: s.lng });
      reverseSeq.current++; // invalida cualquier reverse previo
      const r = suggestionToResolved(s);
      setResolved(r);
      onResolved?.(r);
    },
    [onChange, onResolved],
  );

  const handleAddressInput = useCallback(
    (raw: string) => {
      setAddressQuery(raw);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (raw.trim().length < 3) {
        setShowSuggestions(false);
        setSuggestions([]);
        setSearchingAddr(false);
        return;
      }
      setSearchingAddr(true);
      setShowSuggestions(true);
      searchTimer.current = setTimeout(async () => {
        const seq = ++reverseSeq.current;
        try {
          const results = await searchAddress(raw);
          if (seq !== reverseSeq.current) return;
          setSuggestions(results);
          setSearchingAddr(false);
        } catch {
          if (seq !== reverseSeq.current) return;
          setSuggestions([]);
          setSearchingAddr(false);
        }
      }, 350);
    },
    [],
  );

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
      setFlyZoom(13);
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
        setFlyZoom(15);
        const validation = validatePlaceCoordinates(pos.lat, pos.lng);
        if (validation.valid) {
          onChange({ lat: pos.lat, lng: pos.lng });
          runReverse(pos.lat, pos.lng);
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
  }, [onChange, runReverse]);

  return (
    <div className={cn("flex flex-col gap-gap-sm", className)}>
      {/* Búsqueda por dirección (Photon) */}
      <div className="relative">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={addressQuery}
            onChange={(e) => handleAddressInput(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Busca la dirección: ej. Calle Heredia e/ San Pedro y Santo Tomás..."
            className="w-full h-[38px] pl-9 pr-9 rounded-lv bg-muted border border-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
          {searchingAddr && (
            <Loader2
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-accent animate-spin"
            />
          )}
        </div>

        {showSuggestions && addressQuery.trim().length >= 3 && (
          <div className="absolute left-0 right-0 z-[600] mt-1 bg-surface border border-border rounded-lv-lg shadow-lv-lg overflow-hidden max-h-[240px] overflow-y-auto">
            {suggestions.length === 0 && !searchingAddr && (
              <div className="px-3 py-2 text-[12px] text-muted-foreground">
                Sin coincidencias de calle. Escribe la dirección o toca el mapa.
              </div>
            )}
            {suggestions.map((s, i) => (
              <button
                key={`${s.lat}-${s.lng}-${i}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectSuggestion(s);
                }}
                className="flex items-start gap-2 w-full px-3 py-2 text-left hover:bg-muted transition-colors cursor-pointer"
              >
                <CornerDownLeft size={13} className="text-accent mt-[2px] shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] text-foreground truncate">
                    {[s.street, s.housenumber].filter(Boolean).join(" ")}
                    {s.between && (
                      <span className="text-muted-foreground"> e/ {s.between}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {[s.district, s.city].filter(Boolean).join(" · ") || "Cuba"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="relative h-[320px] lg:h-[380px] rounded-lv-lg overflow-hidden border border-border">
        <PickerMap
          value={value}
          onPointChange={handleMapPoint}
          flyTarget={flyTarget}
          flyZoom={flyZoom}
        />

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

      {/* Dirección detectada + coordenadas */}
      <div className="flex flex-col gap-[4px] px-1">
        {resolved?.label && (
          <span className="text-[13px] font-medium text-foreground flex items-start gap-[6px]">
            <MapPin size={14} className="text-accent shrink-0 mt-[1px]" />
            <span>
              {resolved.label}
              <span className="block text-[11px] font-normal text-muted-foreground">
                {resolved.address}
              </span>
            </span>
          </span>
        )}
        <span className="text-meta text-muted-foreground flex items-center gap-[6px]">
          {value
            ? `${value.lat.toFixed(4)}° N, ${Math.abs(value.lng).toFixed(4)}° O`
            : "Sin punto seleccionado"}
          {value && (
            <CheckCircle2 size={13} className="text-lv-teal ml-auto shrink-0" />
          )}
        </span>
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
