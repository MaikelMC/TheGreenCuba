"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useCallback, useEffect, useRef, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { Search, Star, MapPin, X, RefreshCw, WifiOff, Navigation, Heart, Share2, DollarSign, MessageCircle, ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { fadeUp, popIn, staggerContainer } from "@/lib/motion";
import { CategoryBar } from "@/components/layout/category-bar";
import { BottomSheet } from "@/components/layout/bottom-sheet";
import { PlaceCard } from "@/components/layout/place-card";
import { SearchingAnimation } from "@/components/layout/searching-animation";
import { MapView } from "@/components/map/MapView";
import { PlaceFilters } from "@/components/place/place-filters";
import { StateView } from "@/components/ui/state-view";
import { CategoryIcon } from "@/components/admin/category-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading";
import { useSearchActions } from "@/providers/search-provider";
import { getCurrentPosition, getLastKnownPosition } from "@/lib/map/geolocation";
import {
  buildDirectRoute,
  buildGoogleMapsUrl,
  fetchDrivingRoute,
  formatDistanceM,
  formatDurationSec,
  haversineM,
  type RouteResult,
  type RoutePoint,
} from "@/lib/map/routing";
import { toast } from "sonner";
import type { MapPlace } from "@/components/map/types";
import { usePlaces } from "@/providers/places-provider";
import { placeIcon, type BusinessCategory } from "@/lib/places";
import { matchesPlaceFilters } from "@/lib/place-filters";
import type { UserPlace } from "@/lib/places-store";
import {
  readUserPreferences,
  mergeRemoteUserPreferences,
  writeUserPreferences,
  locationCenter,
  preferredLocationCenter,
  type UserPreferences,
} from "@/lib/user-preferences-store";
import { personalizePlaces } from "@/lib/personalized-recommendations";
import {
  placeInUserProvince,
  queryMentionsOtherProvince,
  userProvinceLabel,
} from "@/lib/user-province";
import { pushRecentSearch } from "@/lib/recent-searches-store";

type SheetState = "default" | "searching" | "results" | "no-results" | "error";

interface HomePlace {
  id: string;
  name: string;
  category: string;
  barrio: string;
  rating: number;
  distance: string;
  price: string;
  /** Nombre del icono Lucide, ya resuelto con la reserva de la categoría. */
  icon: string;
  tags: { label: string; variant?: "mlc" | "open" | "default" }[];
  desc: string;
  lat: number;
  lng: number;
  boosted?: boolean;
}

function userPlaceToHomePlace(
  p: UserPlace,
  /** Catálogo del almacén, para que el icono que el admin cambia a una
      categoría llegue también a las tarjetas y no solo al pin. */
  categories: BusinessCategory[],
  /** Distancia a la ubicación del usuario, en metros. Con ella la tarjeta
      muestra la distancia real; con `null` cae a la dirección, que es el
      único dato que hay. */
  distanceM: number | null,
): HomePlace {
  const tags: HomePlace["tags"] = [
    {
      label: p.status === "active" ? "Abierto" : "Cerrado",
      variant: p.status === "active" ? "open" : "default",
    },
  ];
  if (p.isBoosted) tags.push({ label: "Destacado" });
  if (p.payments.includes("MLC")) tags.push({ label: "USD Clásica", variant: "mlc" });
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    barrio: p.barrio || "Cuba",
    rating: p.rating ?? 0,
    distance:
      distanceM !== null
        ? formatDistanceM(distanceM)
        : p.distanceLabel || p.address || p.barrio || "Ver en el mapa",
    price: p.priceLabel || "—",
    icon: placeIcon(p.icon, p.category, categories),
    tags,
    desc: p.description || "Negocio agregado por su dueño en La Verde.",
    lat: p.lat,
    lng: p.lng,
    boosted: p.isBoosted,
  };
}

const SHEET_TITLES: Record<SheetState, { title: string; subtitle: string }> = {
  default: { title: "Recomendaciones", subtitle: "Lugares cerca de ti" },
  searching: { title: "Buscando", subtitle: "Analizando tu consulta..." },
  results: { title: "Resultados", subtitle: "4 cafés tranquilos en Santiago" },
  "no-results": { title: "Sin resultados", subtitle: "Intenta con otra búsqueda" },
  error: { title: "Error de conexión", subtitle: "Verifica tu conexión a internet" },
};

function googleMapsUrl(
  place: HomePlace,
  userLocation: { lat: number; lng: number } | null,
): string {
  const origin = userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng }
    : undefined;
  if (!origin) {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }
  return buildGoogleMapsUrl(origin, { lat: place.lat, lng: place.lng });
}

function DetailOverlay({
  place,
  onClose,
  onNavigate,
  route,
  userLocation,
}: {
  place: HomePlace | null;
  onClose: () => void;
  onNavigate?: (place: HomePlace) => void;
  route?: RouteResult | null;
  userLocation: { lat: number; lng: number; accuracy?: number } | null;
}) {
  return (
    <AnimatePresence>
      {place && (
        <div className="fixed inset-0 z-[400] flex flex-col">
          <motion.div
            className="absolute inset-0 bg-ink/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-4xl flex flex-col max-h-[85vh]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.6, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.12, type: "spring", stiffness: 260, damping: 22 }}
              className="h-[200px] bg-gradient-to-br from-verde-50 to-verde-100 rounded-t-4xl grid place-items-center text-[64px] relative shrink-0"
            >
              <CategoryIcon
                icon={place.icon}
                size={72}
                strokeWidth={1.4}
                className="text-verde-600"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="absolute top-gap-sm right-gap-sm size-9 rounded-full bg-white/90 backdrop-blur grid place-items-center text-ink shadow-soft z-[5]"
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={1.8} />
              </motion.button>
            </motion.div>

            <motion.div
              className="flex-1 overflow-y-auto px-5 py-5"
              variants={staggerContainer(0.07, 0.15)}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={fadeUp}>
                <h3 className="font-lv-display text-h2 font-bold tracking-[-0.02em] text-ink">
                  {place.name}
                </h3>
                <p className="text-small text-ink-soft/75 mb-gap-sm">
                  {place.category} · {place.barrio}
                </p>
              </motion.div>

              <motion.div variants={fadeUp} className="flex gap-gap-md flex-wrap mb-gap-md">
                {place.rating > 0 && (
                  <span className="inline-flex items-center gap-[4px] font-lv-display text-small font-semibold text-verde-600">
                    <Star size={16} fill="currentColor" />
                    {place.rating}
                  </span>
                )}
                <span className="inline-flex items-center gap-[4px] font-lv-display text-small text-ink-soft/75">
                  <MapPin size={16} strokeWidth={1.8} />
                  {place.distance}
                </span>
                <span className="inline-flex items-center gap-[4px] font-lv-display text-small text-ink-soft/75">
                  <DollarSign size={16} strokeWidth={1.8} />
                  {place.price}
                </span>
              </motion.div>

              {/* Mismas etiquetas que la tarjeta de la lista (PlaceCard). */}
              <motion.div variants={fadeUp} className="flex gap-[6px] flex-wrap mb-5">
                {place.tags.map((tag) => (
                  <span
                    key={tag.label}
                    className={cn(
                      "font-lv-display text-[11px] font-medium px-2 py-[2px] rounded-full",
                      tag.variant === "mlc" ? "bg-sand-deep text-ink-soft/75"
                      : tag.variant === "open" ? "bg-verde-100 text-verde-700"
                      : "bg-sand text-ink-soft/75",
                    )}
                  >
                    {tag.label}
                  </span>
                ))}
              </motion.div>

              <motion.p variants={fadeUp} className="text-body leading-relaxed text-ink mb-5 text-pretty">
                {place.desc}
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-col gap-[10px] pb-safe-bottom">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onNavigate?.(place)}
                  className="flex flex-1 items-center justify-center gap-2 min-h-12 px-6 py-3 rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
                >
                  <Navigation size={18} strokeWidth={1.8} />
                  Cómo llegar
                </motion.button>
                {route && route.distanceM > 0 && (
                  <div className="flex items-center justify-between gap-[10px] px-1">
                    <span className="font-lv-display text-small font-medium text-ink">
                      {formatDistanceM(route.distanceM)} · {formatDurationSec(route.durationSec)}
                    </span>
                    <a
                      href={googleMapsUrl(place, userLocation)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-lv-display text-small font-medium text-verde-600 transition-colors duration-500 hover:text-verde-700"
                    >
                      Abrir en Google Maps
                      <ExternalLink size={13} strokeWidth={1.8} />
                    </a>
                  </div>
                )}
                <div className="flex gap-[10px]">
                  <motion.button whileTap={{ scale: 0.9 }} className="flex-1 size-12 rounded-full border border-ink/10 grid place-items-center text-ink-soft/75 transition-colors duration-500 hover:border-verde-300 hover:text-verde-600" aria-label="Compartir">
                    <Share2 size={18} strokeWidth={1.8} />
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} className="flex-1 size-12 rounded-full border border-ink/10 grid place-items-center text-ink-soft/75 transition-colors duration-500 hover:border-verde-300 hover:text-verde-600" aria-label="Favorito">
                    <Heart size={18} strokeWidth={1.8} />
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-gap-sm">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-[14px] p-[14px] border border-ink/5 rounded-2xl">
          <div className="size-16 rounded-xl shrink-0 skeleton-shimmer" />
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

// Fila memoizada de la lista: cuando cambia solo el lugar seleccionado/favorito,
// React salta el re-render de las filas restantes (antes toda la lista re-rendereaba).
const PlaceCardRow = memo(function PlaceCardRow({
  place,
  index,
  selected,
  liked,
  onSelect,
  onLike,
  onDetail,
  onLocate,
  onDoubleClick,
}: {
  place: HomePlace;
  index: number;
  selected: boolean;
  liked: boolean;
  onSelect: (id: string) => void;
  onLike: (id: string) => void;
  onDetail: (id: string) => void;
  onLocate: (place: HomePlace) => void;
  onDoubleClick: (place: HomePlace) => void;
}) {
  return (
    <div onDoubleClick={() => onDoubleClick(place)}>
      <PlaceCard
        index={index}
        name={place.name}
        category={`${place.category} · ${place.barrio}`}
        rating={place.rating}
        distance={place.distance}
        price={place.price}
        icon={place.icon}
        tags={place.tags}
        selected={selected}
        liked={liked}
        onSelect={() => onSelect(place.id)}
        onLike={() => onLike(place.id)}
        onDetail={() => onDetail(place.id)}
        onLocate={() => onLocate(place)}
      />
    </div>
  );
});

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sheetState, setSheetState] = useState<SheetState>("default");
  const [selectedId, setSelectedId] = useState<string>("6");
  /* Contador, no booleano: cada pin tocado pide otra vez recoger la hoja. */
  const [collapseKey, setCollapseKey] = useState(0);
  /* Contador también: cada búsqueda pide abrir la hoja de nuevo. Con solo
     `forceOpen` la segunda búsqueda no reabría nada —el booleano ya estaba en
     `true` desde la primera— y los resultados quedaban escondidos bajo la hoja
     recogida. */
  const [openKey, setOpenKey] = useState(0);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set(["6"]));
  const [activeCategory, setActiveCategory] = useState("all");
  /* Filtros acumulables del mapa. Viven aquí y no dentro de `PlaceFilters`
     porque es esta pantalla la que filtra: allí se encendían y no salían de
     casa. */
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [detailPlace, setDetailPlace] = useState<HomePlace | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<RoutePoint | null>(null);
  const [routeDest, setRouteDest] = useState<HomePlace | null>(null);
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
  const [viewTarget, setViewTarget] = useState<{
    lat: number;
    lng: number;
    zoom: number;
    key: number;
  } | null>(null);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [disableAutoFit, setDisableAutoFit] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [hasSavedProfileLocation, setHasSavedProfileLocation] = useState(false);
  const searchCtx = useSearchActions();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const viewKey = useRef(0);
  /* Las categorías las sirve el provider, que las trae de la base. Antes se
     leían de `localStorage` aquí aparte, así que la pantalla podía estar
     pintando un catálogo y el panel de admin editando otro: cambiar el icono
     de una categoría no movía ni un pin del mapa. */
  const { places, categories, hydrated } = usePlaces();

  /* Solo categorías con al menos un negocio en el catálogo. Con la lista
     completa, la barra ofrecía 12 chips y 7 llevaban a «sin resultados» —
     cada opción muerta cuesta tiempo de decisión (Ley de Hick) y confianza.
     Se recalcula con el catálogo: cuando se apruebe el primer restaurante,
     el chip vuelve solo. Mientras el catálogo carga solo queda «Todo». */
  const categoriesWithPlaces = useMemo(() => {
    const present = new Set(places.map((p) => p.category.toLowerCase()));
    return categories.filter((c) => present.has(c.label.toLowerCase()));
  }, [places, categories]);

  useEffect(() => {
    let alive = true;
    const resolveInitialCenter = (prefs: UserPreferences | null): [number, number] | null => {
      const profileCenter = preferredLocationCenter(prefs?.location);
      if (profileCenter) return profileCenter;

      const cached = getLastKnownPosition();
      return cached ? [cached.lat, cached.lng] : null;
    };

    fetch("/api/me")
      .then((res) => res.json())
      .then((data: {
        authenticated?: boolean;
        user?: {
          id?: string;
          locationCity?: string | null;
          onboardingCompleted?: boolean;
          preferences?: { interests?: string[]; moods?: string[]; currencies?: string[] } | null;
        } | null;
      }) => {
        if (!alive) return;

        if (data.authenticated && data.user?.id) {
          const storedPrefs = mergeRemoteUserPreferences(readUserPreferences(data.user.id), data.user);
          writeUserPreferences(storedPrefs, data.user.id);
          setUserPreferences(storedPrefs);
          setHasSavedProfileLocation(Boolean(storedPrefs.location && storedPrefs.location !== "otra"));

          const preferredCenter = resolveInitialCenter(storedPrefs);
          if (preferredCenter) {
            setInitialCenter(preferredCenter);
            setDisableAutoFit(true);
          }
          return;
        }

        setHasSavedProfileLocation(false);
        const fallbackPrefs = readUserPreferences();
        setUserPreferences(fallbackPrefs);
        const fallbackCenter = resolveInitialCenter(fallbackPrefs);
        if (fallbackCenter) {
          setInitialCenter(fallbackCenter);
          setDisableAutoFit(true);
        }
      })
      .catch(() => {
        setHasSavedProfileLocation(false);
        const fallbackPrefs = readUserPreferences();
        setUserPreferences(fallbackPrefs);
        const fallbackCenter = resolveInitialCenter(fallbackPrefs);
        if (fallbackCenter) {
          setInitialCenter(fallbackCenter);
          setDisableAutoFit(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggleFilter = useCallback((value: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  /* Un solo filtrado para los dos sitios que pintan el catálogo —los pines del
     mapa y la lista del panel inferior—, para que no puedan discrepar. El chip
     de categoría se encendía y no filtraba nada: `activeCategory` no lo leía
     nadie. */
  const filterContext = useMemo(
    () => ({
      categoryLabel:
        activeCategory === "all"
          ? null
          : (categories.find((c) => c.value === activeCategory)?.label ?? null),
      filters: activeFilters,
      origin: userLocation,
      /* Se evalúa al filtrar, no en cada render: «Abiertos ahora» cambia con la
         hora, pero no hace falta recalcularlo cada segundo. */
      now: new Date(),
    }),
    [activeCategory, categories, activeFilters, userLocation],
  );

  const visiblePlaces = useMemo(
    () => places.filter((p) => matchesPlaceFilters(p, filterContext)),
    [places, filterContext],
  );

  const mapPlaces = useMemo<MapPlace[]>(
    () =>
      visiblePlaces.map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        category: p.category,
        icon: placeIcon(p.icon, p.category, categories),
        barrio: p.barrio,
        rating: p.rating,
        distance: p.distanceLabel || p.address || p.barrio,
        price: p.priceLabel,
        tags: [
          ...(p.isBoosted ? [{ label: "Destacado", variant: "open" as const }] : []),
          ...(p.payments.includes("MLC")
            ? [{ label: "USD Clásica", variant: "mlc" as const }]
            : []),
        ],
      })),
    [visiblePlaces, categories],
  );

  const filteredPlaces = useMemo<HomePlace[]>(() => {
    /* Origen para medir cercanía: el GPS si lo hay y, si no, el centro de la
       provincia del perfil. Antes el fallback no existía y la lista quedaba
       sin orden para quien no había dado permiso de ubicación — el mismo
       criterio que ya usa el desplegable de sugerencias del header. */
    const profileCenter = preferredLocationCenter(userPreferences?.location);
    const origin = userLocation ?? getLastKnownPosition() ??
      (profileCenter ? { lat: profileCenter[0], lng: profileCenter[1] } : null);
    const ranked = userPreferences ? personalizePlaces(visiblePlaces, userPreferences) : visiblePlaces;

    const measured = ranked.map((place) => ({
      place,
      distanceM: origin ? haversineM(origin, { lat: place.lat, lng: place.lng }) : null,
    }));

    if (origin) {
      measured.sort(
        (a, b) =>
          (a.distanceM ?? Number.POSITIVE_INFINITY) - (b.distanceM ?? Number.POSITIVE_INFINITY),
      );
    }

    return measured.map(({ place, distanceM }) =>
      userPlaceToHomePlace(place, categories, distanceM),
    );
  }, [visiblePlaces, categories, userLocation, userPreferences]);

  const handleLike = useCallback((id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* Tocar una card de recomendaciones recoge la hoja hasta dejar el asa: el
     negocio se queda resaltado en el mapa, y con la lista delante no se veía. */
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setCollapseKey((k) => k + 1);
  }, []);

  // Tocar el fondo del mapa quita la selección, como en cualquier mapa.
  const handleDeselect = useCallback(() => {
    setSelectedId("");
  }, []);

  const handleDetail = useCallback(
    (id: string) => {
      router.push(`/place/${id}`);
    },
    [router],
  );

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchingQuery(query);
      /* Abre la hoja en cuanto arranca la búsqueda, siempre: primera o décima. */
      setOpenKey((k) => k + 1);
      /* Al historial del buscador en cuanto sale la consulta, sin esperar a la
         respuesta: lo que se guarda es lo que se buscó, salga bien o mal. Toda
         búsqueda pasa por aquí —la barra del header y los atajos de «sin
         resultados»—, así que es el único punto que hace falta. */
      pushRecentSearch(query);
      setAiState(null);
      setSheetState("searching");
      searchCtx.setIsSearching(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 28000);
      try {
        /* La ubicación entra en la búsqueda: sin ella el modelo elige por
           parecido y no hay forma de cumplir «lo más cercano a mí». Se usa la
           misma que ya usan las rutas —la del estado y, si todavía no llegó, la
           última conocida—.

           El catálogo va ordenado por cercanía, y no solo con el número dentro:
           un orden es mucho más difícil de ignorar que un campo suelto. */
        const origin = userLocation ?? getLastKnownPosition();
        /* La provincia del perfil entra en la búsqueda, y también decide el
           filtro duro: si la consulta nombra otra provincia («restaurantes en
           La Habana»), el usuario la pidió explícitamente y no se recorta. */
        const province = userProvinceLabel(userPreferences);
        const mentionsOther = province ? queryMentionsOtherProvince(query, province) : false;
        const pool =
          province && !mentionsOther
            ? places.filter((p) => placeInUserProvince(p, province))
            : places;

        const catalog = (pool.length > 0 ? pool : places)
          .map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            barrio: p.barrio,
            payments: p.payments,
            schedule: p.schedule,
            description: p.description,
            /* Sin ubicación el campo no viaja, y el modelo lo lee como
               «distancia desconocida», que es exactamente la verdad. */
            distanceM: origin
              ? Math.round(haversineM(origin, { lat: p.lat, lng: p.lng }))
              : undefined,
          }))
          .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
        const res = await fetch("/api/ai/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            places: catalog,
            /* El prompt solo la usa si la consulta no nombra otra provincia:
               si la nombró, el catálogo ya va entero y la regla de provincia
               no debe anular lo que el usuario pidió explícitamente. */
            userProvince: mentionsOther ? null : province,
          }),
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
    [places, searchCtx, userLocation, userPreferences],
  );

  useEffect(() => {
    searchCtx.registerSearchHandler(handleSearch);
  }, [searchCtx, handleSearch]);

  // Una dirección elegida en el buscador del header vuela el mapa hasta esa calle.
  useEffect(() => {
    searchCtx.registerLocateHandler((target) => {
      setViewTarget({
        lat: target.lat,
        lng: target.lng,
        zoom: 17,
        key: ++viewKey.current,
      });
    });
  }, [searchCtx]);

  const handleRetry = useCallback(() => {
    if (searchingQuery) {
      handleSearch(searchingQuery);
      return;
    }
    setSheetState("searching");
    setOpenKey((k) => k + 1);
    searchCtx.setIsSearching(true);
    setTimeout(() => {
      setSheetState("results");
      searchCtx.setIsSearching(false);
    }, 2500);
  }, [searchingQuery, handleSearch, searchCtx]);

  /* Tocar un pin del mapa solo selecciona: la hoja no se toca. El popup sale
     del propio pin y ya se abre solo. */
  const handleMarkerClick = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleCardDoubleClick = useCallback((place: HomePlace) => {
    setDetailPlace(place);
  }, []);

  /* Vuela el mapa hasta un lugar al tocar su botón de ubicación —el 📍 "Ver en
     el mapa" de la card—, lo resalta y recoge la hoja. Las tres cosas van
     juntas: sin vuelo no se llega, sin resaltado el pin se pierde entre los
     demás, y sin recogerla el negocio queda justo detrás de la lista. */
  const handleLocate = useCallback((place: HomePlace) => {
    setSelectedId(place.id);
    setFocusTarget((prev) => ({
      lat: place.lat,
      lng: place.lng,
      key: (prev?.key ?? 0) + 1,
    }));
    setCollapseKey((k) => k + 1);
  }, []);

  const handleUserLocated = useCallback((lat: number, lng: number, accuracy?: number) => {
    setUserLocation({ lat, lng, accuracy });
    setSheetState("default");
  }, []);

  // Resuelve y dibuja la ruta desde la ubicación del usuario hasta un lugar.
  // Intenta OSRM primero; si no hay cobertura/red, usa línea recta como fallback.
  // `openOverlay` decide si además se abre la ficha (botón "Cómo llegar") o si
  // solo se pinta la ruta sobre el mapa (botón "Ruta guiada" del popup).
  const drawRoute = useCallback(
    async (place: HomePlace, openOverlay: boolean) => {
      const origin = userLocation ?? getLastKnownPosition();
      if (!origin) {
        toast.error(
          "Activa tu ubicación para calcular la ruta. Pulsa el botón 'Mi ubicación' en el mapa.",
        );
        return;
      }
      const originPoint: RoutePoint = { lat: origin.lat, lng: origin.lng };
      const destPoint: RoutePoint = { lat: place.lat, lng: place.lng };

      setRouteOrigin(originPoint);
      setRouteDest(place);
      setSelectedId(place.id);
      if (openOverlay) setDetailPlace(place);
      else setDetailPlace(null);

      const osrm = await fetchDrivingRoute(originPoint, destPoint);
      if (osrm) {
        setRoute(osrm);
        return;
      }
      const direct = buildDirectRoute(originPoint, destPoint);
      setRoute(direct);
      toast.info(
        "Ruta por calles no disponible desde tu zona. Mostrando distancia directa; puedes abrir la ruta en Google Maps.",
      );
    },
    [userLocation],
  );

  // Botón "Cómo llegar" de la ficha: abre la ficha y dibuja la ruta.
  const handleNavigate = useCallback(
    (place: HomePlace) => drawRoute(place, true),
    [drawRoute],
  );

  // Botón "Ruta guiada" del popup del marcador: solo pinta la ruta en el mapa.
  const handleRouteFromPopup = useCallback(
    (place: HomePlace) => drawRoute(place, false),
    [drawRoute],
  );

  /* Al llegar desde el botón "Cómo llegar" de la ficha (`?lugar=<id>`) la ruta
     se dibuja sola, y sin abrir la ficha: el usuario viene justo de ella, lo
     que quiere ver es el mapa.

     La ubicación se pide aquí cuando no la tenemos. Con el onboarding hecho el
     mapa no arranca el GPS a propósito —la primera vista es la ciudad elegida—,
     así que antes este gesto se quedaba en nada: mapa quieto, sin ruta y sin
     decir por qué. Nadie toca "Cómo llegar" para no ir a ningún sitio. */
  const placeIdFromUrl = searchParams.get("lugar");
  const pendingPlace = useMemo(
    () => filteredPlaces.find((p) => p.id === placeIdFromUrl) ?? null,
    [placeIdFromUrl, filteredPlaces],
  );

  /* Guarda el id ya dibujado, no un booleano: si el usuario vuelve a la ficha y
     elige otro negocio, este mismo montaje tiene que atender al segundo. */
  const routedPlaceId = useRef<string | null>(null);
  const askingLocation = useRef(false);

  useEffect(() => {
    if (!pendingPlace || routedPlaceId.current === pendingPlace.id) return;

    if (userLocation) {
      routedPlaceId.current = pendingPlace.id;
      handleRouteFromPopup(pendingPlace);
      return;
    }

    if (askingLocation.current) return;
    askingLocation.current = true;
    /* `useCache` —el valor por defecto— deja pasar una lectura reciente sin
       volver a preguntar por el permiso, y solo baja al GPS si no hay ninguna. */
    getCurrentPosition()
      .then((pos) => handleUserLocated(pos.lat, pos.lng, pos.accuracy))
      .catch((err: Error) => {
        toast.error(err?.message || "No pudimos obtener tu ubicación para calcular la ruta.");
      })
      .finally(() => {
        askingLocation.current = false;
      });
  }, [pendingPlace, userLocation, handleRouteFromPopup, handleUserLocated]);

  // Limpia la ruta del mapa.
  const handleClearRoute = useCallback(() => {
    setRoute(null);
    setRouteOrigin(null);
    setRouteDest(null);
  }, []);

  // Al cargar, si el usuario completó el onboarding, centra el mapa en la
  // provincia que eligió. La geolocalización (más abajo) lo refina con la
  // ubicación real cuando hay permiso.
  useEffect(() => {
    if (!userPreferences) return;

    const cached = getLastKnownPosition();
    const preferredCenter =
      userPreferences.onboardingCompleted && userPreferences.location !== "otra"
        ? locationCenter(userPreferences.location)
        : cached
          ? ([cached.lat, cached.lng] as [number, number])
          : null;

    if (preferredCenter) {
      setInitialCenter(preferredCenter);
      setDisableAutoFit(true);
    }
  }, [userPreferences]);

  // Request location once when the home view loads, so the first map shown is
  // the user's local area (works on desktop and mobile). We first apply the
  // last known position from cache (so the map already opens centered on the
  // user), then request the real current position to refine it. Errors produce
  // a hint; the floating "Mi ubicación" button handles explicit requests.
  useEffect(() => {
    // Con onboarding completado y una provincia guardada, la primera vista es
    // SIEMPRE la ciudad elegida. El cache de geolocalización solo sirve como
    // respaldo y no debe desplazar el mapa sobre esa elección.
    if (!userPreferences || hasSavedProfileLocation) {
      return;
    }

    let cancelled = false;

    const cached = getLastKnownPosition();
    if (cached && !cancelled) {
      setUserLocation({
        lat: cached.lat,
        lng: cached.lng,
        accuracy: cached.accuracy,
      });
    }

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
  }, [handleUserLocated, hasSavedProfileLocation, userPreferences]);

  const sheetInfo = SHEET_TITLES[sheetState];
  const showBadge = sheetState === "default" || sheetState === "results";

  const sheetSubtitle =
    sheetState === "results" && searchingQuery
      ? `Resultados para "${searchingQuery}"`
      : sheetInfo.subtitle;

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
    ? `Encontré <strong>4 lugares tranquilos</strong> cerca de ti. <strong>Hotel Casa Granda</strong> es el más cercano, en el Centro histórico.`
    : `Según tu ubicación en <strong>Santiago de Cuba</strong>, encontré <strong>${places.length} lugares</strong> que podrían gustarte. El mejor match es <strong>Castillo del Morro</strong>, a la entrada de la bahía.`;

  return (
    <div className="fixed inset-0 pt-[var(--header-h)] font-lv text-ink">
<MapView
          ref={mapRef}
          places={mapPlaces}
          selectedPlaceId={selectedId}
          initialCenter={initialCenter ?? undefined}
          initialZoom={disableAutoFit ? 13 : undefined}
          disableAutoFit={disableAutoFit}
          onPlaceSelect={(place) => handleMarkerClick(place.id)}
          onMapClick={handleDeselect}
        onPlaceRoute={(place) => {
          const target = filteredPlaces.find((p) => p.id === place.id);
          if (target) handleRouteFromPopup(target);
        }}
        userLocation={userLocation}
        onUserLocated={handleUserLocated}
        focusTarget={focusTarget}
        viewTarget={viewTarget}
        route={route}
        routeOrigin={routeOrigin}
        routePlaceId={routeDest?.id ?? null}
        onRouteClear={handleClearRoute}
      >
        <CategoryBar
          categories={categoriesWithPlaces}
          active={activeCategory}
          onSelect={setActiveCategory}
        />
        <PlaceFilters
          active={activeFilters}
          onToggle={toggleFilter}
          hasLocation={userLocation !== null}
        />
      </MapView>

      {/* Chip de ruta activa (sin ficha abierta) */}
      <AnimatePresence>
        {route && routeDest && !detailPlace && route.distanceM > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="absolute left-1/2 -translate-x-1/2 z-[300] top-gap-sm flex items-center gap-[10px] rounded-full bg-white/95 backdrop-blur border border-ink/5 shadow-soft px-4 py-[10px]"
          >
            <span className="flex items-center gap-[6px] font-lv-display text-small font-medium text-ink">
              <Navigation size={14} strokeWidth={1.8} className="text-verde-600" />
              {formatDistanceM(route.distanceM)} · {formatDurationSec(route.durationSec)}
            </span>
            <a
              href={googleMapsUrl(routeDest, userLocation)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-lv-display text-small font-medium text-verde-600 transition-colors duration-500 hover:text-verde-700"
            >
              Google Maps
              <ExternalLink size={13} strokeWidth={1.8} />
            </a>
            <button
              onClick={handleClearRoute}
              className="grid place-items-center size-6 rounded-full text-ink-soft/75 transition-colors duration-500 hover:bg-sand hover:text-ink"
              aria-label="Cerrar ruta"
            >
              <X size={14} strokeWidth={1.8} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Sheet. Solo `searching` fuerza la hoja abierta: al llegar los
          resultados tiene que poder recogerse —pin 📍 o card tocada— para
          dejar ver el mapa y el negocio, igual que en la vista inicial. Con
          `!== "default"` la guarda de forceOpen seguía viva en `results` y la
          recogida no hacía nada después de una búsqueda. */}
      <BottomSheet
        className="home-bottom-sheet"
        title={sheetInfo.title}
        subtitle={sheetSubtitle}
        badge={showBadge ? String(shownCount) : undefined}
        forceOpen={sheetState === "searching"}
        collapseSignal={collapseKey}
        openSignal={openKey}
      >
        {/* Default / Results state */}
        {(sheetState === "default" || sheetState === "results") && (
          <AnimatePresence mode="wait">
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* AI Banner */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="recommendations-ai-banner flex items-start gap-gap-sm p-[14px] bg-verde-50 border border-verde-200 rounded-2xl mb-gap-md"
              >
                <div className="size-9 rounded-xl bg-gradient-to-br from-verde-400 to-verde-600 grid place-items-center text-white shrink-0">
                  <MessageCircle size={18} strokeWidth={1.8} />
                </div>
                <p className="text-small leading-relaxed text-ink">
                  {sheetState === "results" && aiState && aiState.summary
                    ? aiState.summary
                    : !hydrated
                      ? "Estoy viendo qué hay cerca de ti…"
                      : `Según tu ubicación en Santiago de Cuba, encontré ${places.length} lugares que podrían gustarte. Explora el mapa o busca con lenguaje natural.`}
                </p>
              </motion.div>

              {/* Place list. Mientras el catálogo llega de la base, skeletons
                  con la forma de las tarjetas: sin esto el sheet contaba
                  «0 lugares» y el mapa arrancaba sin pines hasta que la
                  respuesta aterrizaba de golpe. */}
              <div className="flex flex-col gap-gap-sm" aria-busy={!hydrated}>
                {!hydrated &&
                  [1, 2, 3].map((i) => (
                    <div
                      key={`sk-${i}`}
                      className="flex gap-[14px] p-[14px] border border-ink/5 rounded-2xl"
                    >
                      <Skeleton className="size-16 rounded-xl shrink-0" />
                      <div className="flex-1 flex flex-col gap-2 pt-1">
                        <Skeleton className="h-[14px] w-[65%]" />
                        <Skeleton className="h-[12px] w-[40%]" />
                        <Skeleton className="h-[12px] w-[85%]" />
                      </div>
                    </div>
                  ))}
                {resultPlaces.map((place, i) => (
                  <PlaceCardRow
                    key={place.id}
                    place={place}
                    index={i}
                    selected={selectedId === place.id}
                    liked={likedIds.has(place.id)}
                    onSelect={handleSelect}
                    onLike={handleLike}
                    onDetail={handleDetail}
                    onLocate={handleLocate}
                    onDoubleClick={handleCardDoubleClick}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Searching state */}
        {sheetState === "searching" && (
          <AnimatePresence mode="wait">
            <motion.div
              key="searching"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <SearchingAnimation query={searchingQuery} />
              <LoadingSkeleton />
            </motion.div>
          </AnimatePresence>
        )}

        {/* No results state */}
        {sheetState === "no-results" && (
          <AnimatePresence mode="wait">
            <motion.div
              key="no-results"
              variants={popIn}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -14, transition: { duration: 0.2 } }}
            >
              <StateView
                icon={Search}
                title="Sin resultados"
                description={
                  searchingQuery
                    ? `No encontramos lugares que coincidan con “${searchingQuery}”. Intenta con otra búsqueda.`
                    : "No encontramos lugares que coincidan con tu búsqueda. Intenta con otras palabras."
                }
                actions={["Hoteles en el centro", "Playas cerca", "Lugares históricos"].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSearch(s)}
                    className="px-3.5 py-2 rounded-full border border-ink/10 bg-white font-lv-display text-small font-medium text-ink-soft/75 transition-all duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600"
                  >
                    {s}
                  </button>
                ))}
              />
            </motion.div>
          </AnimatePresence>
        )}

        {/* Error state */}
        {sheetState === "error" && (
          <AnimatePresence mode="wait">
            <motion.div
              key="error"
              variants={popIn}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -14, transition: { duration: 0.2 } }}
            >
              <StateView
                className="pb-5"
                variant="offline"
                icon={WifiOff}
                title="Sin conexión"
                description="No se pudo conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo."
                actions={
                  <Button className="gap-[6px]" onClick={handleRetry}>
                    <RefreshCw size={16} strokeWidth={2} />
                    Reintentar
                  </Button>
                }
              />
              <div className="mx-5 mb-5 p-gap-sm bg-verde-50 border border-verde-200 rounded-2xl text-meta text-verde-700 text-left">
                <strong>Tip para conexiones lentas:</strong> La Verde guarda tus búsquedas recientes en caché. Puedes ver los últimos resultados sin conexión.
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </BottomSheet>

      {/* Detail overlay */}
      <DetailOverlay
        place={detailPlace}
        onClose={() => {
          setDetailPlace(null);
          handleClearRoute();
        }}
        onNavigate={handleNavigate}
        route={route}
        userLocation={userLocation}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-sand" aria-busy />}>
      <HomePageContent />
    </Suspense>
  );
}
