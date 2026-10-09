"use client";

import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  memo,
} from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Star,
  MapPin,
  X,
  RefreshCw,
  WifiOff,
  Navigation,
  Heart,
  Share2,
  DollarSign,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn, formatDateRange } from "@/lib/utils";
import { fadeUp, popIn, staggerContainer } from "@/lib/motion";
import { CategoryBar } from "@/components/layout/category-bar";
import { BottomSheet } from "@/components/layout/bottom-sheet";
import { PlaceCard } from "@/components/layout/place-card";
import { SearchingAnimation } from "@/components/layout/searching-animation";
import { MapView } from "@/components/map/MapView";
import { MapNotifications } from "@/components/map/map-notifications";
import { PlaceFilters } from "@/components/place/place-filters";
import { StateView } from "@/components/ui/state-view";
import { CategoryIcon } from "@/components/admin/category-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading";
import { useSearchActions } from "@/providers/search-provider";
import {
  getCurrentPosition,
  getLastKnownPosition,
} from "@/lib/map/geolocation";
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
import { hayOferta } from "@/lib/ofertas";
import { energiaParaIA } from "@/lib/energia";
import type { UserPlace, UserPlaceMenuItem } from "@/lib/places-store";
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
  placeOutsideUserProvince,
  queryMentionsOtherProvince,
  userProvinceLabel,
} from "@/lib/user-province";
import { pushRecentSearch } from "@/lib/recent-searches-store";
import { saveAiRecommendations } from "@/lib/ai-recommendation-store";
import { sharePlace } from "@/lib/share";
import {
  trackAiSearchCompleted,
  trackAiSearchSubmitted,
  trackCategorySelect,
  trackFilterToggle,
  trackMapLocate,
  trackMapMarkerClick,
  trackRouteRequested,
} from "@/lib/analytics";
import { trackPlaceMetric } from "@/lib/place-metrics";

type SheetState = "default" | "searching" | "results" | "no-results" | "error";

/* Cuántas entradas de «Lo que ofrece» viajan a la búsqueda con IA.
   El formulario no pone tope a la carta, así que lo pone aquí: sin él, ochenta
   lugares con una carta larga convierten la petición en un documento. */
const MENU_ITEMS_PER_PLACE = 12;

/**
 * Pide el consentimiento de novedades, una sola vez, a quien entró con Google.
 *
 * Quien se registró con Google nunca vio la casilla del alta, así que su
 * `marketing_opt_in` es `false` por defecto y no por decisión. Se aprovecha el
 * `/api/me` que el home ya pide —no hay una llamada de más— y el aviso se marca
 * como visto en `localStorage` bajo la clave del usuario: «único» de verdad, no
 * una vez por sesión.
 *
 * `optedIn` y `isGoogle` los decide el servidor (`/api/me`); aquí solo se pinta.
 * Si el navegador bloquea `localStorage`, se calla en vez de repetir el aviso en
 * cada carga.
 */
const MARKETING_ASKED_KEY = "la-verde:marketing-asked";

function askMarketingConsentOnce(
  userId: string,
  marketing?: { optedIn?: boolean; isGoogle?: boolean },
): void {
  if (!marketing?.isGoogle || marketing.optedIn) return;

  const key = `${MARKETING_ASKED_KEY}:${userId}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    return;
  }

  toast("¿Te avisamos de lo que pasa en La Verde?", {
    description: "Novedades de lugares y planes, de vez en cuando. Nada más.",
    duration: 15000,
    action: {
      label: "Sí, quiero",
      onClick: () => {
        void fetch("/api/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketingOptIn: true }),
        });
      },
    },
  });
}

/**
 * La carta, en una línea por producto o servicio, para el catálogo que va al
 * modelo: «Ropa Vieja de Res: 12 MLC», «Mojito de la casa (2x1): 5 MLC».
 *
 * `price` es texto libre y **puede venir vacío** —un servicio sin precio, tipo
 * «Wi-Fi gratis»—, así que los dos puntos solo se ponen cuando hay algo detrás.
 * La foto y la descripción de cada plato se quedan fuera a propósito: son el
 * grueso del peso y el modelo no las necesita para elegir. Ver `CatalogPlace`.
 */
function menuLines(menu: UserPlaceMenuItem[]): string[] | undefined {
  const lines = menu
    .slice(0, MENU_ITEMS_PER_PLACE)
    .map((item) => {
      const name = item.name.trim();
      if (!name) return "";
      const tag = item.tag?.trim();
      const price = item.price.trim();
      return `${name}${tag ? ` (${tag})` : ""}${price ? `: ${price} ${item.currency}` : ""}`;
    })
    .filter(Boolean);
  return lines.length > 0 ? lines : undefined;
}

interface HomePlace {
  id: string;
  name: string;
  isProject?: boolean;
  category: string;
  barrio: string;
  rating: number;
  distance: string;
  price: string;
  /** Nombre del icono Lucide, ya resuelto con la reserva de la categoría. */
  icon: string;
  /** Logo del negocio. Manda sobre el icono en la miniatura de la tarjeta. */
  logoUrl?: string;
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
  if (p.selloVerificado)
    tags.push({ label: "Verificado", variant: "open" });
  /* Va antes que «Destacado» y «USD Clásica» a propósito: de una tarjeta se
     leen dos o tres chapitas, y una oferta que caduca hoy importa más que el
     medio de pago. */
  if (hayOferta(p.ofertas)) tags.push({ label: "Oferta", variant: "open" });
  if (p.isBoosted) tags.push({ label: "Destacado" });
  if (p.payments.includes("MLC"))
    tags.push({ label: "USD Clásica", variant: "mlc" });
  return {
    id: p.id,
    name: p.name,
    isProject: p.isProject,
    category: p.category,
    barrio: p.barrio || "Cuba",
    rating: p.rating ?? 0,
    distance:
      distanceM !== null
        ? formatDistanceM(distanceM)
        : p.distanceLabel || p.address || p.barrio || "Ver en el mapa",
    price: p.priceLabel || "—",
    icon: placeIcon(p.icon, p.category, categories),
    logoUrl: p.logoUrl,
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
  "no-results": {
    title: "Sin resultados",
    subtitle: "Intenta con otra búsqueda",
  },
  error: {
    title: "Error de conexión",
    subtitle: "Verifica tu conexión a internet",
  },
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
              transition={{
                delay: 0.12,
                type: "spring",
                stiffness: 260,
                damping: 22,
              }}
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

              <motion.div
                variants={fadeUp}
                className="flex gap-gap-md flex-wrap mb-gap-md"
              >
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
              <motion.div
                variants={fadeUp}
                className="flex gap-[6px] flex-wrap mb-5"
              >
                {place.tags.map((tag) => (
                  <span
                    key={tag.label}
                    className={cn(
                      "font-lv-display text-[11px] font-medium px-2 py-[2px] rounded-full",
                      tag.variant === "mlc"
                        ? "bg-sand-deep text-ink-soft/75"
                        : tag.variant === "open"
                          ? "bg-verde-100 text-verde-700"
                          : "bg-sand text-ink-soft/75",
                    )}
                  >
                    {tag.label}
                  </span>
                ))}
              </motion.div>

              <motion.p
                variants={fadeUp}
                className="text-body leading-relaxed text-ink mb-5 text-pretty"
              >
                {place.desc}
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="flex flex-col gap-[10px] pb-safe-bottom"
              >
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
                      {formatDistanceM(route.distanceM)} ·{" "}
                      {formatDurationSec(route.durationSec)}
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
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => place && sharePlace(place.id, place.name)}
                    className="flex-1 size-12 rounded-full border border-ink/10 grid place-items-center text-ink-soft/75 transition-colors duration-500 hover:border-verde-300 hover:text-verde-600"
                    aria-label="Compartir"
                  >
                    <Share2 size={18} strokeWidth={1.8} />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    className="flex-1 size-12 rounded-full border border-ink/10 grid place-items-center text-ink-soft/75 transition-colors duration-500 hover:border-verde-300 hover:text-verde-600"
                    aria-label="Favorito"
                  >
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
        <div
          key={i}
          className="flex gap-[14px] p-[14px] border border-ink/5 rounded-2xl"
        >
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
        logoUrl={place.logoUrl}
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
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
  } | null>(null);
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
  /* El primer render ya sabe la ciudad del perfil: localStorage es síncrono y
     el onboarding guardó la provincia ahí. Antes este estado nacía en null y
     solo se llenaba cuando /api/me contestaba — entre tanto MapContent montaba
     con su default HAVANA_CENTER y el efecto de initialCenter volaba después a
     la provincia: el rebote La Habana → Santiago en CADA entrada al home, no
     solo al iniciar sesión. Con la semilla síncrona el MapContainer nace
     directo en la ciudad correcta y, si /api/me confirma la misma, el guard de
     igualdad de MapChildren ni siquiera dispara el flyTo. */
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(
    () => {
      if (typeof window === "undefined") return null;
      return preferredLocationCenter(readUserPreferences().location);
    },
  );
  const [disableAutoFit, setDisableAutoFit] = useState(initialCenter !== null);
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);
  const [hasSavedProfileLocation, setHasSavedProfileLocation] = useState(false);
  const searchCtx = useSearchActions();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const viewKey = useRef(0);
  /* Las categorías las sirve el provider, que las trae de la base. Antes se
     leían de `localStorage` aquí aparte, así que la pantalla podía estar
     pintando un catálogo y el panel de admin editando otro: cambiar el icono
     de una categoría no movía ni un pin del mapa. */
  const { places, categories, hydrated } = usePlaces();

  /* La provincia del perfil recorta el catálogo, y lo recorta **para dos
     sitios y solo dos**: la lista de recomendaciones y el catálogo que viaja a
     la búsqueda con IA. Lo que se recorta es lo que se **recomienda**, no lo
     que se **enseña**: el mapa dibuja el catálogo entero, porque un negocio que
     existe no debe desaparecer del mapa por la provincia de quien mira. Antes
     este recorte alimentaba también los pines, y quien elegía Santiago veía un
     mapa con la mitad de la ciudad.

     Lleva la misma red que la búsqueda: si la provincia elegida no tiene ni un
     negocio en el catálogo, pasa el catálogo entero. Un home vacío por un dato
     mal escrito en una fila es peor que una recomendación de más.

     Sin provincia —«otra», valor viejo, o perfil sin ubicación— no se recorta
     nada: no saber dónde está el usuario no es estar fuera de su provincia.

     Y por eso se recorta con `placeOutsideUserProvince` y no con
     `!placeInUserProvince`: lo segundo echaba fuera los negocios cuya ficha no
     trae ciudad ni provincia —los que nacen del alta del perfil, que no las
     pregunta—, que es justo lo contrario de «no saber no recorta». */
  const provinceScopedPlaces = useMemo(() => {
    const province = userProvinceLabel(userPreferences);
    if (!province) return places;
    const pool = places.filter((p) => !placeOutsideUserProvince(p, province));
    return pool.length > 0 ? pool : places;
  }, [places, userPreferences]);

  /* Solo categorías con al menos un negocio en el catálogo. Con la lista
     completa, la barra ofrecía 12 chips y 7 llevaban a «sin resultados» —
     cada opción muerta cuesta tiempo de decisión (Ley de Hick) y confianza.
     Se recalcula con el catálogo: cuando se apruebe el primer restaurante,
     el chip vuelve solo. Mientras el catálogo carga solo queda «Todo».

     Va con el catálogo entero y no con el recortado por provincia: los chips
     filtran el mapa, y ofrecer solo las categorías de tu provincia dejaba
     pines en el mapa que ningún chip alcanzaba. */
  const categoriesWithPlaces = useMemo(() => {
    const present = new Set(places.map((p) => p.category.toLowerCase()));
    return categories.filter((c) => present.has(c.label.toLowerCase()));
  }, [places, categories]);

  useEffect(() => {
    let alive = true;
    const resolveInitialCenter = (
      prefs: UserPreferences | null,
    ): [number, number] | null => {
      const profileCenter = preferredLocationCenter(prefs?.location);
      if (profileCenter) return profileCenter;

      const cached = getLastKnownPosition();
      return cached ? [cached.lat, cached.lng] : null;
    };

    fetch("/api/me")
      .then((res) => res.json())
      .then(
        (data: {
          authenticated?: boolean;
          marketing?: { optedIn?: boolean; isGoogle?: boolean };
          user?: {
            id?: string;
            locationCity?: string | null;
            onboardingCompleted?: boolean;
            preferences?: {
              interests?: string[];
              moods?: string[];
              currencies?: string[];
            } | null;
          } | null;
        }) => {
          if (!alive) return;

          if (data.authenticated && data.user?.id) {
            /* Una sola vez por persona: a quien entró con Google se le pregunta
               aquí, no en el alta, porque nunca vio la casilla. */
            askMarketingConsentOnce(data.user.id, data.marketing);

            const storedPrefs = mergeRemoteUserPreferences(
              readUserPreferences(data.user.id),
              data.user,
            );
            writeUserPreferences(storedPrefs, data.user.id);
            setUserPreferences(storedPrefs);
            setHasSavedProfileLocation(
              Boolean(storedPrefs.location && storedPrefs.location !== "otra"),
            );

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
        },
      )
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

  const toggleFilter = useCallback(
    (value: string) => {
      trackFilterToggle(value, !activeFilters.has(value));
      setActiveFilters((prev) => {
        const next = new Set(prev);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      });
    },
    [activeFilters],
  );

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

  /* Los pines: el catálogo **entero** con los chips del usuario encima. Lo
     único que los puede quitar del mapa es un chip que el propio usuario
     encendió —ni la provincia del perfil ni nada que no haya pedido él—. */
  const mapVisiblePlaces = useMemo(
    () => places.filter((p) => matchesPlaceFilters(p, filterContext)),
    [places, filterContext],
  );

  /* Y la lista del panel, que es la que recomienda: ahí sí manda la provincia,
     con los mismos chips encima. Son dos universos a propósito —el mapa
     enseña, la lista sugiere— y por eso el recorte provincial ya no puede
     colarse en los pines. */
  const listVisiblePlaces = useMemo(
    () =>
      provinceScopedPlaces.filter((p) => matchesPlaceFilters(p, filterContext)),
    [provinceScopedPlaces, filterContext],
  );

  const mapPlaces = useMemo<MapPlace[]>(
    () =>
      mapVisiblePlaces.map((p) => ({
        id: p.id,
        name: p.name,
        isProject: p.isProject,
        lat: p.lat,
        lng: p.lng,
        category: p.category,
        icon: placeIcon(p.icon, p.category, categories),
        /* El logo primero: es la marca del negocio y se reconoce mejor en un
           disco de 15 px que una foto de fachada. Después la foto del mapa y la
           portada, como antes. */
        image:
          p.logoUrl ??
          p.mapImageUrl ??
          p.photos?.find((photo) => photo.isCover)?.url ??
          p.photos?.[0]?.url,
        /* Y el popup al revés: la portada primero, que en una tarjeta ancha la
           foto del lugar dice más que la marca, y el logo solo cuando no hay
           ninguna foto subida. */
        coverImage:
          p.photos?.find((photo) => photo.isCover)?.url ??
          p.photos?.[0]?.url ??
          p.logoUrl,
        offerPackages: p.offerPackages,
        barrio: p.barrio,
        rating: p.rating,
        distance: p.distanceLabel || p.address || p.barrio,
        price: p.priceLabel,
        /* La energía viaja al popup y al pin: es lo que decide si alguien va
           durante un apagón, y en el mapa se ve antes que en la ficha. */
        energiaRespaldo: p.energiaRespaldo ?? null,
        notaApagon: p.notaApagon,
        /* Las ofertas viajan enteras al pin: quién decide si hay alguna viva es
           `hayOferta`, en el marcador, para que el `%` desaparezca solo cuando
           caduque sin volver a pedir el catálogo. */
        ofertas: p.ofertas,
        /* El popup de un proyecto enseña sus fechas en lugar del precio: es el
           dato que decide si se va, y el proyecto no tiene precio de carta. */
        schedule:
          p.isProject && p.schedule ? formatDateRange(p.schedule) : undefined,
        tags: [
          /* Mismo sello que en la lista de resultados, y por el mismo motivo:
             `selloVerificado` es lo que ya decidió el servidor —verificado y plan
             que lo incluye—. En el popup del mapa se ve antes que en la ficha. */
          ...(p.selloVerificado
            ? [{ label: "Verificado", variant: "open" as const }]
            : []),
          ...(p.isBoosted
            ? [{ label: "Destacado", variant: "open" as const }]
            : []),
          ...(p.payments.includes("MLC")
            ? [{ label: "USD Clásica", variant: "mlc" as const }]
            : []),
          /* «Oferta» en verde y no en arena: es lo que hace mirar la ficha
             ahora mismo. Solo si hay alguna viva —una caducada no anuncia
             nada—. Ver `hayOferta`. */
          ...(hayOferta(p.ofertas)
            ? [{ label: "Oferta", variant: "open" as const }]
            : []),
        ],
      })),
    [mapVisiblePlaces, categories],
  );

  const filteredPlaces = useMemo<HomePlace[]>(() => {
    /* Origen para medir cercanía: el GPS si lo hay y, si no, el centro de la
       provincia del perfil. Antes el fallback no existía y la lista quedaba
       sin orden para quien no había dado permiso de ubicación — el mismo
       criterio que ya usa el desplegable de sugerencias del header. */
    const profileCenter = preferredLocationCenter(userPreferences?.location);
    const origin =
      userLocation ??
      getLastKnownPosition() ??
      (profileCenter ? { lat: profileCenter[0], lng: profileCenter[1] } : null);
    const ranked = userPreferences
      ? personalizePlaces(listVisiblePlaces, userPreferences)
      : listVisiblePlaces;

    const measured = ranked.map((place) => ({
      place,
      distanceM: origin
        ? haversineM(origin, { lat: place.lat, lng: place.lng })
        : null,
    }));

    if (origin) {
      measured.sort(
        (a, b) =>
          (a.distanceM ?? Number.POSITIVE_INFINITY) -
          (b.distanceM ?? Number.POSITIVE_INFINITY),
      );
    }

    return measured.map(({ place, distanceM }) =>
      userPlaceToHomePlace(place, categories, distanceM),
    );
  }, [listVisiblePlaces, categories, userLocation, userPreferences]);

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
      trackAiSearchSubmitted(query);
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
        const mentionsOther = province
          ? queryMentionsOtherProvince(query, province)
          : false;
        const pool =
          province && !mentionsOther
            ? places.filter((p) => !placeOutsideUserProvince(p, province))
            : places;

        const catalog = (pool.length > 0 ? pool : places)
          .map((p) => ({
            id: p.id,
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            category: p.category,
            barrio: p.barrio,
            city: p.city,
            province: p.province,
            payments: p.payments,
            schedule: p.schedule,
            description: p.description,
            /* La carta viaja con la búsqueda: sin ella el modelo solo podía
               juzgar por categoría y descripción, así que «¿dónde como pizza
               barata?» no tenía con qué responderse. `menuLines` la deja en una
               línea por plato y fuera van la foto y la descripción de cada uno,
               que es donde se iba el peso. */
            menu: menuLines(p.menu),
            /* La energía va en palabras y **solo cuando hay algo que decir**:
               `energiaParaIA` calla el «ninguna» y el hueco, porque contarle al
               modelo «este NO tiene corriente» en una consulta que busca sitios
               con corriente solo sirve para que lo descarte dos veces. Ver
               `src/lib/energia.ts`. */
            energia: energiaParaIA(p.energiaRespaldo) ?? undefined,
            /* Sin ubicación el campo no viaja, y el modelo lo lee como
               «distancia desconocida», que es exactamente la verdad. */
            distanceM: origin
              ? Math.round(haversineM(origin, { lat: p.lat, lng: p.lng }))
              : undefined,
          }))
          .sort(
            (a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity),
          );
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
        const matches = (data.matches ?? [])
          .filter((m) => m && m.id)
          .slice(0, 5);
        for (const m of matches) trackPlaceMetric(m.id, "ai_match");
        /* Las razones se guardan aquí y no al abrir la ficha: la lista se
           ordena con ellas y luego se van con el estado del componente, así que
           este es el único momento en que existen. La ficha las lee de
           `localStorage` para poder enseñar qué se buscó y por qué salió. */
        saveAiRecommendations(query, matches);
        setAiState({ matches, summary: data.summary ?? "" });
        setSheetState(matches.length > 0 ? "results" : "no-results");
        trackAiSearchCompleted(
          query,
          matches.length,
          matches.length > 0 ? "ok" : "empty",
        );
      } catch {
        trackAiSearchCompleted(query, 0, "error");
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
    trackMapMarkerClick(id);
    trackPlaceMetric(id, "map_click");
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
    trackMapLocate(place.id);
    setSelectedId(place.id);
    setFocusTarget((prev) => ({
      lat: place.lat,
      lng: place.lng,
      key: (prev?.key ?? 0) + 1,
    }));
    setCollapseKey((k) => k + 1);
  }, []);

  const handleUserLocated = useCallback(
    (lat: number, lng: number, accuracy?: number) => {
      setUserLocation({ lat, lng, accuracy });
      setSheetState("default");
    },
    [],
  );

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
        trackPlaceMetric(place.id, "route");
        trackRouteRequested(place.id, openOverlay ? "ficha" : "popup", false);
        return;
      }
      const direct = buildDirectRoute(originPoint, destPoint);
      setRoute(direct);
      trackPlaceMetric(place.id, "route");
      trackRouteRequested(place.id, openOverlay ? "ficha" : "popup", true);
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

  /* El negocio de un id, venga de donde venga, para dibujar una ruta.
   *
   * Busca en el catálogo **entero** y no en la lista de recomendaciones. Antes
   * las dos entradas de ruta —la ficha por `?lugar=<id>` y el botón del popup—
   * buscaban en `filteredPlaces`, que iba recortado por provincia: con el mapa
   * enseñando ya todos los pines, tocar el de otra provincia y pedirle la ruta
   * se quedaba en nada, sin error y sin decir por qué. El mapa y estos dos
   * atajos tienen que mirar el mismo universo. */
  const placeById = useCallback(
    (id: string | null): HomePlace | null => {
      if (!id) return null;
      const found = places.find((p) => p.id === id);
      return found ? userPlaceToHomePlace(found, categories, null) : null;
    },
    [places, categories],
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
    () => placeById(placeIdFromUrl),
    [placeIdFromUrl, placeById],
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
        toast.error(
          err?.message ||
            "No pudimos obtener tu ubicación para calcular la ruta.",
        );
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

  // Show session notice if coming from login
  useEffect(() => {
    if (searchParams.get("showSessionNotice") === "1") {
      // Only show once per session
      if (
        typeof window !== "undefined" &&
        !sessionStorage.getItem("sessionNoticeShown")
      ) {
        toast.info(
          "Tu sesión permanecerá activa por 7 días en este dispositivo. Cuando vuelvas entrarás directo al home de tu cuenta.",
        );
        sessionStorage.setItem("sessionNoticeShown", "true");
      }
    }
  }, [searchParams]);

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
  const shownCount =
    sheetState === "results" ? resultPlaces.length : recommendationCount;

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
          const target = placeById(place.id);
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
          onSelect={(value) => {
            setActiveCategory(value);
            trackCategorySelect(value);
          }}
        />
        <PlaceFilters
          active={activeFilters}
          onToggle={toggleFilter}
          hasLocation={userLocation !== null}
        />
        <MapNotifications />
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
              <Navigation
                size={14}
                strokeWidth={1.8}
                className="text-verde-600"
              />
              {formatDistanceM(route.distanceM)} ·{" "}
              {formatDurationSec(route.durationSec)}
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
                transition={{
                  delay: 0.08,
                  duration: 0.4,
                  ease: [0.22, 1, 0.36, 1],
                }}
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
                      : `Según tu ubicación en ${userProvinceLabel(userPreferences) ?? "Cuba"}, encontré ${provinceScopedPlaces.length} lugares que podrían gustarte. Explora el mapa o busca con lenguaje natural.`}
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
                actions={[
                  "Hoteles en el centro",
                  "Playas cerca",
                  "Lugares históricos",
                ].map((s) => (
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
                <strong>Tip para conexiones lentas:</strong> La Verde guarda tus
                búsquedas recientes en caché. Puedes ver los últimos resultados
                sin conexión.
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
