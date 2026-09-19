"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Crosshair, MapPin, Search, CheckCircle2, Loader2, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { CUBA_AREAS } from "@/lib/map/cuba-areas";
import { getCurrentPosition, GEO_ERROR_MESSAGES, type GeolocationErrorCode } from "@/lib/map/geolocation";
import { formatCoordinates, validatePlaceCoordinates } from "@/lib/map/coordinates";
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
      <div className="h-full w-full grid place-items-center bg-sand-deep">
        <span className="text-small text-ink-soft/75">Cargando mapa...</span>
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

/* Clases del sistema de La Verde. El selector se monta dentro de formularios ya
   migrados —el panel de negocio y el de administración—, así que no puede
   seguir pintándose con el gris del sistema viejo: `bg-muted`, `border-border`
   y `text-accent` no aparecen ya en ninguna pantalla nueva, y el bloque
   cantaba. Los 44 px de alto tampoco son decoración: es el mínimo táctil, y
   esto se maneja con el pulgar tanto como con el ratón. */
const FIELD =
  "h-11 w-full rounded-xl border border-ink/10 bg-white text-small text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/30";
const FLOAT_BTN =
  "absolute top-gap-sm z-[500] inline-flex items-center gap-[6px] rounded-full border border-ink/5 bg-white/95 px-gap-sm py-[7px] font-lv-display text-meta font-medium text-ink shadow-soft backdrop-blur-[12px] transition-colors duration-500 ease-outquint";
const AREA_CHIP =
  "rounded-full border border-ink/10 bg-white px-gap-sm py-[6px] font-lv-display text-meta font-medium text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600";

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
            strokeWidth={1.8}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft/75"
          />
          <input
            value={addressQuery}
            onChange={(e) => handleAddressInput(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Busca la dirección: ej. Calle Heredia e/ San Pedro y Santo Tomás..."
            className={cn(FIELD, "pl-11 pr-10")}
          />
          {searchingAddr && (
            <Loader2
              size={15}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-verde-600 animate-spin"
            />
          )}
        </div>

        {showSuggestions && addressQuery.trim().length >= 3 && (
          <div className="absolute left-0 right-0 z-[600] mt-1 max-h-[240px] overflow-y-auto rounded-2xl border border-ink/5 bg-white shadow-card">
            {suggestions.length === 0 && !searchingAddr && (
              <div className="px-gap-md py-gap-sm text-meta text-ink-soft/75">
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
                className="flex w-full cursor-pointer items-start gap-gap-xs px-gap-md py-gap-sm text-left transition-colors duration-500 ease-outquint hover:bg-sand"
              >
                <CornerDownLeft
                  size={13}
                  strokeWidth={1.8}
                  className="mt-[3px] shrink-0 text-verde-600"
                />
                <div className="min-w-0">
                  <div className="truncate text-small text-ink">
                    {[s.street, s.housenumber].filter(Boolean).join(" ")}
                    {s.between && (
                      <span className="text-ink-soft/75"> e/ {s.between}</span>
                    )}
                  </div>
                  <div className="truncate text-meta text-ink-soft/75">
                    {[s.district, s.city].filter(Boolean).join(" · ") || "Cuba"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="relative h-[320px] overflow-hidden rounded-2xl border border-ink/5 lg:h-[380px]">
        <PickerMap
          value={value}
          onPointChange={handleMapPoint}
          flyTarget={flyTarget}
          flyZoom={flyZoom}
        />

        {/* Hint */}
        <div className="pointer-events-none absolute left-gap-sm top-gap-sm z-[500] max-w-[70%]">
          <div className="inline-flex items-center gap-[6px] rounded-full border border-ink/5 bg-white/95 px-gap-sm py-[6px] font-lv-display text-meta font-medium text-ink shadow-soft backdrop-blur-[12px]">
            <MapPin size={14} strokeWidth={1.8} className="shrink-0 text-verde-600" />
            Toca el mapa para colocar el pin
          </div>
        </div>

        {/* Locate button */}
        <button
          type="button"
          onClick={handleLocate}
          disabled={locateBusy}
          className={cn(
            FLOAT_BTN,
            "right-gap-sm hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 disabled:opacity-60",
          )}
        >
          <Crosshair size={14} strokeWidth={1.8} className={cn(locateBusy && "animate-spin")} />
          {locateBusy ? "Ubicando..." : "Mi ubicación"}
        </button>
      </div>

      {/* Locate error */}
      {locateError && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-gap-sm py-[7px] text-meta font-medium text-destructive">
          {locateError}
        </div>
      )}

      {/* Dirección detectada + coordenadas */}
      <div className="flex flex-col gap-[4px] px-1">
        {resolved?.label && (
          <span className="flex items-start gap-[6px] text-small font-medium text-ink">
            <MapPin size={14} strokeWidth={1.8} className="mt-[3px] shrink-0 text-verde-600" />
            <span>
              {resolved.label}
              <span className="block text-meta font-normal text-ink-soft/75">
                {resolved.address}
              </span>
            </span>
          </span>
        )}
        <span className="flex items-center gap-[6px] text-meta text-ink-soft/75">
          {value ? formatCoordinates(value) : "Sin punto seleccionado"}
          {value && (
            <CheckCircle2 size={13} strokeWidth={1.8} className="ml-auto shrink-0 text-verde-500" />
          )}
        </span>
      </div>

      {/* Zone quick-jump */}
      <div className="overflow-hidden rounded-2xl border border-ink/5 bg-white">
        <div className="border-b border-ink/5 p-gap-sm">
          <div className="relative">
            <Search
              size={16}
              strokeWidth={1.8}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft/75"
            />
            <input
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
              placeholder="Buscar ciudad o zona de Cuba..."
              className={cn(FIELD, "pl-11 pr-3.5")}
            />
          </div>
        </div>
        <div className="flex max-h-[132px] flex-wrap gap-[6px] overflow-y-auto p-gap-sm">
          {filteredAreas.length === 0 && (
            <span className="px-1 text-meta text-ink-soft/75">
              No se encontraron zonas.
            </span>
          )}
          {filteredAreas.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => handleSelectArea(area.lat, area.lng)}
              className={AREA_CHIP}
            >
              {area.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
