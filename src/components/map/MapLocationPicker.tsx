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
  searchCubaAreas,
  reverseGeocode,
  type AreaSuggestion,
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
      <div className="map-loading h-full w-full grid place-items-center bg-sand-deep">
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
  const [searchedAreas, setSearchedAreas] = useState<AreaSuggestion[]>([]);
  const [searchingAreas, setSearchingAreas] = useState(false);
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
  const areaSeq = useRef(0);

  // Cancela timers al desmontar.
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      reverseSeq.current++;
      areaSeq.current++;
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
    if (q.length < 2) return [];
    return CUBA_AREAS.filter((area) =>
      normalize(`${area.name} ${area.province}`).includes(q),
    );
  }, [areaQuery]);

  useEffect(() => {
    const query = areaQuery.trim();
    const seq = ++areaSeq.current;
    if (query.length < 2) {
      setSearchedAreas([]);
      setSearchingAreas(false);
      return;
    }

    setSearchingAreas(true);
    const timer = setTimeout(() => {
      searchCubaAreas(query)
        .then((areas) => {
          if (seq === areaSeq.current) setSearchedAreas(areas);
        })
        .catch(() => {
          if (seq === areaSeq.current) setSearchedAreas([]);
        })
        .finally(() => {
          if (seq === areaSeq.current) setSearchingAreas(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [areaQuery]);

  const displayedAreas = useMemo(() => {
    const seen = new Set<string>();
    return [...filteredAreas, ...searchedAreas].filter((area) => {
      const key = `${normalize(area.name)}-${area.lat.toFixed(3)}-${area.lng.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [filteredAreas, searchedAreas]);

  const handleSelectArea = useCallback(
    (lat: number, lng: number) => {
      setFlyTarget({ lat, lng });
      setFlyZoom(13);
      onChange({ lat, lng });
      setAreaQuery("");
      setAddressQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
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
      {/* Zone quick-jump: va antes del mapa para elegir primero una provincia,
          municipio o ciudad y después colocar el pin exacto. */}
      <div className="relative overflow-visible rounded-2xl border border-ink/5 bg-white">
        <div className="p-gap-sm">
          <div className="relative">
            <Search
              size={16}
              strokeWidth={1.8}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft/75"
            />
            <input
              value={addressQuery}
              onChange={(e) => {
                handleAddressInput(e.target.value);
                setAreaQuery(e.target.value);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Buscar dirección, calle o lugar..."
              className={cn(FIELD, "pl-11 pr-10")}
            />
            {searchingAddr && <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-verde-600" />}
          </div>
        </div>
        {showSuggestions && addressQuery.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full z-[600] max-h-[280px] overflow-y-auto rounded-2xl border border-ink/5 bg-white p-gap-xs shadow-card">
            {suggestions.map((s, i) => (
              <button key={`${s.lat}-${s.lng}-${i}`} type="button" onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }} className="flex w-full cursor-pointer items-start gap-gap-xs rounded-xl px-gap-sm py-gap-sm text-left hover:bg-sand">
                <CornerDownLeft size={13} className="mt-[3px] shrink-0 text-verde-600" />
                <span className="min-w-0">
                  <span className="block truncate text-small text-ink">{[s.street, s.housenumber].filter(Boolean).join(" ")}{s.between && <span className="text-ink-soft/75"> e/ {s.between}</span>}</span>
                  <span className="block truncate text-meta text-ink-soft/75">{[s.district, s.city].filter(Boolean).join(" · ") || "Cuba"}</span>
                </span>
              </button>
            ))}
            {displayedAreas.map((area) => (
              <button key={area.id} type="button" onMouseDown={(e) => { e.preventDefault(); handleSelectArea(area.lat, area.lng); }} className="flex w-full items-center gap-gap-xs rounded-xl px-gap-sm py-gap-sm text-left hover:bg-sand">
                <MapPin size={15} className="shrink-0 text-verde-600" />
                <span className="truncate text-small text-ink">{area.name} <span className="text-meta text-ink-soft/60">{area.province}</span></span>
              </button>
            ))}
            {searchingAreas && <span className="block px-gap-sm py-gap-sm text-meta text-ink-soft/75">Buscando en Cuba...</span>}
            {!searchingAddr && !searchingAreas && suggestions.length === 0 && displayedAreas.length === 0 && <span className="block px-gap-sm py-gap-sm text-meta text-ink-soft/75">Sin coincidencias. También puedes tocar el mapa.</span>}
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

    </div>
  );
}
