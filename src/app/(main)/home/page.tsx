"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, Star, MapPin, X, RefreshCw, WifiOff, Navigation, Heart, Share2, Crosshair, DollarSign, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryBar } from "@/components/layout/category-bar";
import { BottomSheet } from "@/components/layout/bottom-sheet";
import { PlaceCard } from "@/components/layout/place-card";
import { MapView } from "@/components/map/map-view";
import { MapMarker } from "@/components/map/map-marker";
import { MapControls } from "@/components/map/map-controls";
import { PlaceFilters } from "@/components/place/place-filters";
import { useSearch } from "@/providers/search-provider";

type SheetState = "default" | "searching" | "results" | "no-results" | "error" | "location";

const MOCK_PLACES = [
  { id: "1", name: "Pastelería La Habanera", category: "Cafetería", barrio: "Centro Habana", rating: 4.5, distance: "800m", price: "$3-8 MLC", emoji: "🍰", tags: [{ label: "MLC", variant: "mlc" as const }, { label: "Abierto", variant: "open" as const }], boosted: false, pos: { top: "28%", left: "35%" }, desc: "Pastelería artesanal con los mejores pasteles de nata de La Habana. Ambiente familiar, ideal para la mañana." },
  { id: "2", name: "Restaurante El Río", category: "Restaurante", barrio: "Vedado", rating: 4.3, distance: "1.1km", price: "$12-25 MLC", emoji: "🍽️", tags: [{ label: "MLC", variant: "mlc" as const }, { label: "Vista al mar", variant: "default" as const }], boosted: false, pos: { top: "45%", left: "55%" }, desc: "Cocina cubana contemporánea con vista al Malecón. Reservaciones recomendadas para cenar." },
  { id: "3", name: "La Guarida", category: "Restaurante", barrio: "Centro Habana", rating: 4.9, distance: "1.2km", price: "$15-35 MLC", emoji: "🍽️", tags: [{ label: "MLC", variant: "mlc" as const }, { label: "Abierto", variant: "open" as const }, { label: "Vista al mar", variant: "default" as const }], boosted: true, pos: { top: "38%", left: "68%" }, desc: "El restaurante más famoso de Cuba. Cocina fusión en un palacio colonial. Reservar con anticipación." },
  { id: "4", name: "Mercado de San José", category: "Mercado", barrio: "Habana Vieja", rating: 4.2, distance: "2.1km", price: "CUP", emoji: "🛍️", tags: [{ label: "Abierto", variant: "open" as const }, { label: "Frutas frescas", variant: "default" as const }, { label: "Barato", variant: "default" as const }], boosted: false, pos: { top: "60%", left: "25%" }, desc: "Mercado artesanal con frutas tropicales, artesanías y souvenirs. Los mejores precios en fruta fresca." },
  { id: "5", name: "Fábrica de Arte Cubano", category: "Vida nocturna", barrio: "Vedado", rating: 4.7, distance: "650m", price: "$8-20 MLC", emoji: "🎵", tags: [{ label: "MLC", variant: "mlc" as const }, { label: "Música en vivo", variant: "default" as const }], boosted: false, pos: { top: "52%", left: "42%" }, desc: "El espacio cultural más vibrante de La Habana. Arte, música en vivo, cine y gastronomía." },
  { id: "6", name: "Café El Ignoto", category: "Cafetería", barrio: "Vedado", rating: 4.8, distance: "350m", price: "$5-12 MLC", emoji: "☕", tags: [{ label: "MLC", variant: "mlc" as const }, { label: "Abierto", variant: "open" as const }, { label: "Tranquilo", variant: "default" as const }], boosted: false, pos: { top: "35%", left: "48%" }, desc: "Café de especialidad en el corazón de Vedado. Acepta MLC, ambiente tranquilo para trabajar o leer." },
];

const SHEET_TITLES: Record<SheetState, { title: string; subtitle: string }> = {
  default: { title: "Recomendaciones", subtitle: "Lugares cerca de ti en La Habana" },
  searching: { title: "Buscando", subtitle: "Analizando tu consulta..." },
  results: { title: "Resultados", subtitle: "4 cafes tranquilos en Vedado" },
  "no-results": { title: "Sin resultados", subtitle: "Intenta con otra búsqueda" },
  error: { title: "Error de conexión", subtitle: "Verifica tu conexión a internet" },
  location: { title: "Ubicación", subtitle: "Activa tu ubicación para mejores resultados" },
};

function DetailOverlay({ place, onClose }: { place: typeof MOCK_PLACES[number] | null; onClose: () => void }) {
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
            <span className="inline-flex items-center gap-[4px] font-mono text-[13px] text-muted-foreground">
              <Star size={16} className="text-accent" fill="currentColor" />
              {place.rating}
            </span>
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
  const [sheetState, setSheetState] = useState<SheetState>("default");
  const [selectedId, setSelectedId] = useState<string>("6");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set(["6"]));
  const [activeCategory, setActiveCategory] = useState("all");
  const [detailPlace, setDetailPlace] = useState<typeof MOCK_PLACES[number] | null>(null);
  const searchCtx = useSearch();
  const sheetStateRef = useRef(sheetState);
  sheetStateRef.current = sheetState;

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

  const handleSearch = useCallback((query: string) => {
    setSheetState("searching");
    searchCtx.setIsSearching(true);
    setTimeout(() => {
      setSheetState("results");
      searchCtx.setIsSearching(false);
    }, 2500);
  }, [searchCtx]);

  useEffect(() => {
    searchCtx.registerSearchHandler(handleSearch);
  }, [searchCtx, handleSearch]);

  const handleRetry = useCallback(() => {
    setSheetState("searching");
    searchCtx.setIsSearching(true);
    setTimeout(() => {
      setSheetState("results");
      searchCtx.setIsSearching(false);
    }, 2500);
  }, [searchCtx]);

  const handleMarkerClick = useCallback((id: string) => {
    setSelectedId(id);
    if (sheetStateRef.current === "peek") {
      setSheetState("half");
    }
  }, []);

  const handleCardDoubleClick = useCallback((place: typeof MOCK_PLACES[number]) => {
    setDetailPlace(place);
  }, []);

  const sheetInfo = SHEET_TITLES[sheetState];
  const showBadge = sheetState === "default" || sheetState === "searching" || sheetState === "results";
  const showFilters = sheetState === "default" || sheetState === "results" || sheetState === "location";

  const filteredPlaces = sheetState === "results"
    ? MOCK_PLACES.filter((p) => p.category === "Cafetería")
    : MOCK_PLACES;

  const resultsBannerText = sheetState === "results"
    ? `Encontré <strong>4 cafes tranquilos</strong> que aceptan MLC cerca de ti. <strong>Café El Ignoto</strong> es el más cercano — 350m, abierto hasta las 10pm.`
    : `Según tu ubicación en <strong>Vedado</strong>, encontré <strong>${MOCK_PLACES.length} lugares</strong> que podrían gustarte. El mejor match es <strong>Café El Ignoto</strong> — está a 3 min y acepta MLC.`;

  return (
    <div className="fixed inset-0 pt-[var(--header-h)]">
      <MapView searching={sheetState === "searching"}>
        <CategoryBar active={activeCategory} onSelect={setActiveCategory} />
        <PlaceFilters visible={showFilters} />

        {/* Map markers */}
        {MOCK_PLACES.map((place) => (
          <MapMarker
            key={place.id}
            variant={selectedId === place.id ? "selected" : place.boosted ? "boosted" : "default"}
            style={{ top: place.pos.top, left: place.pos.left }}
            selected={selectedId === place.id}
            searching={sheetState === "searching"}
            onClick={() => handleMarkerClick(place.id)}
            data-place={place.id}
          />
        ))}

        <MapControls
          className="absolute right-gutter bottom-[180px] flex flex-col gap-[2px] lg:right-[440px] lg:bottom-auto lg:top-[90px]"
          onLocate={() => setSheetState("location")}
        />
      </MapView>

      {/* Bottom Sheet */}
      <BottomSheet
        title={sheetInfo.title}
        subtitle={sheetInfo.subtitle}
        badge={showBadge ? "IA" : undefined}
      >
        {/* Default / Results state */}
        {(sheetState === "default" || sheetState === "results") && (
          <>
            {/* AI Banner */}
            <div className="flex items-start gap-gap-sm p-[14px] bg-gradient-to-br from-accent/[0.06] to-accent/[0.02] border border-accent/15 rounded-lv-lg mb-gap-md">
              <div className="size-9 rounded-[10px] bg-accent grid place-items-center text-white shrink-0">
                <MessageCircle size={18} strokeWidth={2} />
              </div>
              <p
                className="text-[14px] leading-[1.5] text-foreground"
                dangerouslySetInnerHTML={{ __html: resultsBannerText }}
              />
            </div>

            {/* Place list */}
            <div className="flex flex-col gap-gap-sm">
              {filteredPlaces.map((place) => (
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
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Searching state */}
        {sheetState === "searching" && (
          <>
            <div className="flex items-start gap-gap-sm p-[14px] bg-gradient-to-br from-accent/[0.06] to-accent/[0.02] border border-accent/15 rounded-lv-lg mb-gap-md opacity-60">
              <div className="size-9 rounded-[10px] bg-accent grid place-items-center text-white shrink-0">
                <span className="inline-flex gap-[4px] items-center">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              </div>
              <p className="text-[14px] leading-[1.5] text-foreground">
                Analizando tu búsqueda en lenguaje natural...
              </p>
            </div>
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

        {/* Location state */}
        {sheetState === "location" && (
          <div className="text-center py-10 px-5">
            <div className="size-16 rounded-full bg-lv-blue/8 grid place-items-center mx-auto mb-gap-md text-lv-blue relative">
              <Crosshair size={28} strokeWidth={1.8} />
              <span className="absolute inset-0 rounded-full border-2 border-lv-blue animate-ping opacity-50" />
            </div>
            <h3 className="font-display text-[18px] font-semibold text-foreground mb-2">
              Activar ubicación
            </h3>
            <p className="text-[14px] text-muted-foreground max-w-[30ch] mx-auto mb-5">
              Para encontrar los lugares más cercanos, necesitamos acceder a tu ubicación. Tus datos no se comparten.
            </p>
            <button
              onClick={() => setSheetState("default")}
              className="inline-flex items-center gap-[6px] px-5 py-[10px] bg-accent text-white rounded-lv font-display text-[14px] font-semibold hover:bg-accent-hover transition-colors"
            >
              <Crosshair size={16} strokeWidth={2} />
              Permitir ubicación
            </button>
            <button
              onClick={() => setSheetState("default")}
              className="block mt-gap-sm text-[13px] text-muted-foreground mx-auto hover:text-accent transition-colors"
            >
              Usar sin ubicación
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Detail overlay */}
      <DetailOverlay place={detailPlace} onClose={() => setDetailPlace(null)} />
    </div>
  );
}
