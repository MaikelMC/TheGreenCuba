"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Star, MapPin, X, RefreshCw, WifiOff, Navigation, Heart, Share2, DollarSign, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryBar } from "@/components/layout/category-bar";
import { BottomSheet } from "@/components/layout/bottom-sheet";
import { PlaceCard } from "@/components/layout/place-card";
import { SearchingAnimation } from "@/components/layout/searching-animation";
import { MapView } from "@/components/map/MapView";
import { PlaceFilters } from "@/components/place/place-filters";
import { useSearch } from "@/providers/search-provider";
import { getCurrentPosition } from "@/lib/map/geolocation";
import { toast } from "sonner";
import type { MapPlace } from "@/components/map/types";
import { usePlaces } from "@/providers/places-provider";
import { categoryEmoji } from "@/lib/places";
import type { UserPlace } from "@/lib/places-store";

type SheetState = "default" | "searching" | "results" | "no-results" | "error";

interface HomePlace {
  id: string;
  name: string;
  category: string;
  barrio: string;
  rating: number;
  distance: string;
  price: string;
  emoji: string;
  tags: { label: string; variant?: "mlc" | "open" | "default" }[];
  desc: string;
  lat: number;
  lng: number;
  boosted?: boolean;
}

function userPlaceToHomePlace(p: UserPlace): HomePlace {
  const tags: HomePlace["tags"] = [
    {
      label: p.status === "active" ? "Abierto" : "Cerrado",
      variant: p.status === "active" ? "open" : "default",
    },
  ];
  if (p.isBoosted) tags.push({ label: "Destacado" });
  if (p.payments.includes("MLC")) tags.push({ label: "MLC", variant: "mlc" });
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    barrio: p.barrio || "Cuba",
    rating: p.rating ?? 0,
    distance: p.distanceLabel || p.address || p.barrio || "Ver en el mapa",
    price: p.priceLabel || "—",
    emoji: categoryEmoji(p.category),
    tags,
    desc: p.description || "Negocio agregado por su dueño en La Verde.",
    lat: p.lat,
    lng: p.lng,
    boosted: p.isBoosted,
  };
}

const SHEET_TITLES: Record<SheetState, { title: string; subtitle: string }> = {
  default: { title: "Recomendaciones", subtitle: "Lugares cerca de ti en La Habana" },
  searching: { title: "Buscando", subtitle: "Analizando tu consulta..." },
  results: { title: "Resultados", subtitle: "4 cafes tranquilos en Vedado" },
  "no-results": { title: "Sin resultados", subtitle: "Intenta con otra búsqueda" },
  error: { title: "Error de conexión", subtitle: "Verifica tu conexión a internet" },
};

function DetailOverlay({ place, onClose }: { place: HomePlace | null; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (place) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [place]);

  if (!place) return null;

  return (
    <div
        className={cn(
          "fixed inset-0 z-[400] flex flex-col transition-opacity duration-normal",
          visible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
    >
      <div className="absolute inset-0 bg-[oklch(15%_0.01_250_/_0.45)]" onClick={onClose} />
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-surface rounded-t-lv-xl flex flex-col max-h-[85vh] transition-transform duration-slow ease-out",
          visible ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="h-[200px] bg-gradient-to-br from-accent/20 to-lv-green-200/15 rounded-t-lv-xl grid place-items-center text-[64px] relative shrink-0">
          <span>{place.emoji}</span>
          <button
            onClick={onClose}
            className="absolute top-gap-sm right-gap-sm size-9 rounded-full bg-surface/90 backdrop-blur grid place-items-center text-foreground shadow-lv-sm z-[5]"
            aria-label="Cerrar"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <h3 className="font-display text-h2 font-bold tracking-[-0.02em] text-foreground">
            {place.name}
          </h3>
          <p className="text-[14px] text-muted-foreground mb-gap-sm">
            {place.category} · {place.barrio}
          </p>

          <div className="flex gap-gap-md flex-wrap mb-gap-md">
            {place.rating > 0 && (
              <span className="inline-flex items-center gap-[4px] font-mono text-[13px] text-muted-foreground">
                <Star size={16} className="text-accent" fill="currentColor" />
                {place.rating}
              </span>
            )}
            <span className="inline-flex items-center gap-[4px] font-mono text-[13px] text-muted-foreground">
              <MapPin size={16} className="text-accent" />
              {place.distance}
            </span>
            <span className="inline-flex items-center gap-[4px] font-mono text-[13px] text-muted-foreground">
              <DollarSign size={16} className="text-accent" />
              {place.price}
            </span>
          </div>

          <div className="flex gap-[6px] flex-wrap mb-5">
            {place.tags.map((tag) => (
              <span
                key={tag.label}
                className={cn(
                  "text-[11px] px-2 py-[2px] rounded-full border",
                  tag.variant === "mlc" ? "bg-amber/10 text-lv-amber border-amber/20"
                  : tag.variant === "open" ? "bg-lv-teal/10 text-lv-teal border-lv-teal/20"
                  : "bg-background text-muted-foreground border-border",
                )}
              >
                {tag.label}
              </span>
            ))}
          </div>

          <p className="text-[15px] leading-[1.6] text-foreground mb-5 text-pretty">
            {place.desc}
          </p>

          <div className="flex gap-[10px] pb-safe-bottom">
            <button className="flex-1 flex items-center justify-center gap-2 py-[14px] bg-accent text-white rounded-lv font-display text-[15px] font-semibold hover:bg-accent-hover transition-colors">
              <Navigation size={18} strokeWidth={2} />
              Cómo llegar
            </button>
            <button className="size-12 rounded-lv border border-border grid place-items-center text-muted-foreground hover:border-accent hover:text-accent transition-all" aria-label="Compartir">
              <Share2 size={18} strokeWidth={2} />
            </button>
            <button className="size-12 rounded-lv border border-border grid place-items-center text-muted-foreground hover:border-accent hover:text-accent transition-all" aria-label="Favorito">
              <Heart size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-gap-sm">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-[14px] p-[14px] border border-border rounded-lv-lg">
          <div className="size-16 rounded-lv shrink-0 skeleton-shimmer" />
          <div className="flex-1 flex flex-col gap-2 pt-1">
            <div className="h-[14px] skeleton-shimmer rounded w-[65%]" />
            <div className="h-[14px] skeleton-shimmer rounded w-[40%]" />
            <div className="h-[14px] skeleton-shimmer rounded w-[85%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [sheetState, setSheetState] = useState<SheetState>("default");
  const [selectedId, setSelectedId] = useState<string>("6");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set(["6"]));
  const [activeCategory, setActiveCategory] = useState("all");
  const [detailPlace, setDetailPlace] = useState<HomePlace | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [aiState, setAiState] = useState<{
    matches: { id: string; reason: string }[];
    summary: string;
  } | null>(null);
  const [searchingQuery, setSearchingQuery] = useState("");
  const [focusTarget, setFocusTarget] = useState<{
    lat: number;
    lng: number;
    key: number;
  } | null>(null);
  const searchCtx = useSearch();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const { places } = usePlaces();

  const mapPlaces = useMemo<MapPlace[]>(
    () =>
      places.map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        category: p.category,
        barrio: p.barrio,
        rating: p.rating,
        distance: p.distanceLabel || p.address || p.barrio,
        price: p.priceLabel,
        tags: [
          ...(p.isBoosted ? [{ label: "Destacado", variant: "open" as const }] : []),
          ...(p.payments.includes("MLC")
            ? [{ label: "MLC", variant: "mlc" as const }]
            : []),
        ],
      })),
    [places],
  );

  const handleLike = useCallback((id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchingQuery(query);
      setAiState(null);
      setSheetState("searching");
      searchCtx.setIsSearching(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 28000);
      try {
        const catalog = places.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          barrio: p.barrio,
          payments: p.payments,
          schedule: p.schedule,
          description: p.description,
        }));
        const res = await fetch("/api/ai/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, places: catalog }),
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          matches?: { id: string; reason: string }[];
          summary?: string;
        } | null;
        if (!res.ok || !data || data.ok !== true) {
          throw new Error(data?.summary ? "" : "Búsqueda fallida");
        }
        const matches = (data.matches ?? []).filter((m) => m && m.id).slice(0, 5);
        setAiState({ matches, summary: data.summary ?? "" });
        setSheetState(matches.length > 0 ? "results" : "no-results");
      } catch {
        setSheetState("error");
      } finally {
        clearTimeout(timeout);
        searchCtx.setIsSearching(false);
      }
    },
    [places, searchCtx],
  );

  useEffect(() => {
    searchCtx.registerSearchHandler(handleSearch);
  }, [searchCtx, handleSearch]);

  const handleRetry = useCallback(() => {
    if (searchingQuery) {
      handleSearch(searchingQuery);
      return;
    }
    setSheetState("searching");
    searchCtx.setIsSearching(true);
    setTimeout(() => {
      setSheetState("results");
      searchCtx.setIsSearching(false);
    }, 2500);
  }, [searchingQuery, handleSearch, searchCtx]);

  const handleMarkerClick = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleCardDoubleClick = useCallback((place: HomePlace) => {
    setDetailPlace(place);
  }, []);

  // Vuela el mapa hasta un lugar al tocar su botón de ubicación.
  const handleLocate = useCallback((place: HomePlace) => {
    setFocusTarget((prev) => ({
      lat: place.lat,
      lng: place.lng,
      key: (prev?.key ?? 0) + 1,
    }));
  }, []);

  const handleUserLocated = useCallback((lat: number, lng: number, accuracy?: number) => {
    setUserLocation({ lat, lng, accuracy });
    setSheetState("default");
  }, []);

  // Request location once when the home view loads, so the first map shown is
  // the user's local area (works on desktop and mobile). We skip the cache so
  // the real current position is always requested. Errors produce a hint; the
  // floating "Mi ubicación" button handles explicit requests with feedback.
  useEffect(() => {
    let cancelled = false;
    getCurrentPosition({ useCache: false })
      .then((pos) => {
        if (cancelled) return;
        handleUserLocated(pos.lat, pos.lng, pos.accuracy);
      })
      .catch((err) => {
        if (cancelled) return;
        const code = (err as { code?: string }).code;
        if (code === "denied") {
          toast.error(
            "Permiso de ubicación denegado. Habilítalo en el candado junto a la URL y recarga para centrar el mapa en tu zona.",
          );
        } else if (code && code !== "unsupported") {
          toast.error(
            "No pudimos obtener tu ubicación. Pulsa el botón 'Mi ubicación' para intentarlo de nuevo.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [handleUserLocated]);

  const sheetInfo = SHEET_TITLES[sheetState];
  const showBadge = sheetState === "default" || sheetState === "results";
  const showFilters = sheetState === "default" || sheetState === "results";

  const sheetSubtitle =
    sheetState === "results" && searchingQuery
      ? `Resultados para "${searchingQuery}"`
      : sheetInfo.subtitle;

  const filteredPlaces = useMemo<HomePlace[]>(
    () => places.map(userPlaceToHomePlace),
    [places],
  );

  // En resultados, muestra SOLO los lugares que la IA eligió, respetando su orden.
  // En la vista por defecto (sin búsqueda) muestra todo el catálogo.
  const resultPlaces = useMemo<HomePlace[]>(() => {
    if (!aiState || aiState.matches.length === 0) return filteredPlaces;
    const byId = new Map(filteredPlaces.map((p) => [p.id, p]));
    const picked: HomePlace[] = [];
    const seen = new Set<string>();
    for (const m of aiState.matches) {
      const place = byId.get(m.id);
      if (place && !seen.has(place.id)) {
        picked.push(place);
        seen.add(place.id);
      }
    }
    return picked;
  }, [aiState, filteredPlaces]);
  const recommendationCount = filteredPlaces.length;
  const shownCount = sheetState === "results" ? resultPlaces.length : recommendationCount;

  const resultsBannerText = sheetState === "results"
    ? `Encontré <strong>4 cafes tranquilos</strong> que aceptan MLC cerca de ti. <strong>Café El Ignoto</strong> es el más cercano, a 350m, abierto hasta las 10pm.`
    : `Según tu ubicación en <strong>Vedado</strong>, encontré <strong>${places.length} lugares</strong> que podrían gustarte. El mejor match es <strong>Café El Ignoto</strong>, está a 3 min y acepta MLC.`;

  return (
    <div className="fixed inset-0 pt-[var(--header-h)]">
      <MapView
        ref={mapRef}
        places={mapPlaces}
        selectedPlaceId={selectedId}
        onPlaceSelect={(place) => handleMarkerClick(place.id)}
        searching={sheetState === "searching"}
        userLocation={userLocation}
        onUserLocated={handleUserLocated}
        focusTarget={focusTarget}
      >
        <CategoryBar active={activeCategory} onSelect={setActiveCategory} />
        <PlaceFilters visible={showFilters} />
      </MapView>

      {/* Bottom Sheet */}
      <BottomSheet
        className="home-bottom-sheet"
        title={sheetInfo.title}
        subtitle={sheetSubtitle}
        badge={showBadge ? String(shownCount) : undefined}
        forceOpen={sheetState !== "default"}
      >
        {/* Default / Results state */}
        {(sheetState === "default" || sheetState === "results") && (
          <>
            {/* AI Banner */}
            <div className="flex items-start gap-gap-sm p-[14px] bg-gradient-to-br from-accent/[0.06] to-accent/[0.02] border border-accent/15 rounded-lv-lg mb-gap-md">
              <div className="size-9 rounded-[10px] bg-accent grid place-items-center text-white shrink-0">
                <MessageCircle size={18} strokeWidth={2} />
              </div>
              <p className="text-[14px] leading-[1.5] text-foreground">
                {sheetState === "results" && aiState && aiState.summary
                  ? aiState.summary
                  : `Según tu ubicación en Vedado, encontré ${places.length} lugares que podrían gustarte. Explora el mapa o busca con lenguaje natural.`}
              </p>
            </div>

            {/* Place list */}
            <div className="flex flex-col gap-gap-sm">
              {resultPlaces.map((place) => (
                <div
                  key={place.id}
                  onDoubleClick={() => handleCardDoubleClick(place)}
                >
                  <PlaceCard
                    name={place.name}
                    category={`${place.category} · ${place.barrio}`}
                    rating={place.rating}
                    distance={place.distance}
                    price={place.price}
                    emoji={place.emoji}
                    tags={place.tags}
                    selected={selectedId === place.id}
                    liked={likedIds.has(place.id)}
                    onSelect={() => handleSelect(place.id)}
                    onLike={() => handleLike(place.id)}
                    onDetail={() => router.push(`/place/${place.id}`)}
                    onLocate={() => handleLocate(place)}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Searching state */}
        {sheetState === "searching" && (
          <>
            <SearchingAnimation query={searchingQuery} />
            <LoadingSkeleton />
          </>
        )}

        {/* No results state */}
        {sheetState === "no-results" && (
          <div className="text-center py-10 px-5">
            <div className="size-16 rounded-full bg-accent/10 grid place-items-center mx-auto mb-gap-md text-accent">
              <Search size={28} strokeWidth={1.8} />
            </div>
            <h3 className="font-display text-[18px] font-semibold text-foreground mb-2">
              Sin resultados
            </h3>
            <p className="text-[14px] text-muted-foreground max-w-[28ch] mx-auto">
              No encontramos lugares que coincidan con &ldquo;disco con jazz en Vedado&rdquo;. Intenta con otra búsqueda.
            </p>
            <div className="flex flex-wrap gap-[6px] justify-center mt-gap-md">
              {["Discotecas Vedado", "Bar de jazz", "Música en vivo"].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSearch(s)}
                  className="px-3 py-[6px] rounded-full border border-border text-[13px] font-medium text-accent bg-surface hover:bg-accent/10 hover:border-accent transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {sheetState === "error" && (
          <div className="text-center py-10 px-5">
            <div className="size-16 rounded-full bg-destructive/8 grid place-items-center mx-auto mb-gap-md text-destructive">
              <WifiOff size={28} strokeWidth={1.8} />
            </div>
            <h3 className="font-display text-[18px] font-semibold text-foreground mb-2">
              Sin conexión
            </h3>
            <p className="text-[14px] text-muted-foreground max-w-[30ch] mx-auto mb-5">
              No se pudo conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo.
            </p>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-[6px] px-5 py-[10px] bg-accent text-white rounded-lv font-display text-[14px] font-semibold hover:bg-accent-hover transition-colors"
            >
              <RefreshCw size={16} strokeWidth={2} />
              Reintentar
            </button>
            <div className="mt-5 p-gap-sm bg-lv-blue/6 border border-lv-blue/15 rounded-lv text-[13px] text-lv-blue text-left">
              <strong>Tip para conexiones lentas:</strong> La Verde guarda tus búsquedas recientes en caché. Puedes ver los últimos resultados sin conexión.
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Detail overlay */}
      <DetailOverlay place={detailPlace} onClose={() => setDetailPlace(null)} />
    </div>
  );
}
