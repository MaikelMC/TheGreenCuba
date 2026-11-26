"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import {
  Search,
  Star,
  MapPin,
  X,
  RefreshCw,
  WifiOff,
  Navigation,
  Layers,
  Sparkles,
  Heart,
  Share2,
  DollarSign,
  ExternalLink,
  Lock,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn, formatDateRange } from "@/lib/utils";
import { fadeUp, popIn, staggerContainer } from "@/lib/motion";
import { CategoryBar } from "@/components/layout/category-bar";
import { HomeTopBar } from "@/components/home/home-top-bar";
import { HomeSearchOverlay } from "@/components/home/home-search-overlay";
import { BottomSheet } from "@/components/layout/bottom-sheet";
import { LugarCercanoCard } from "@/components/home/lugar-cercano-card";
import { SearchingAnimation } from "@/components/layout/searching-animation";
import { MapView } from "@/components/map/MapView";
import { MapNotifications } from "@/components/map/map-notifications";
import { NovedadesMapa } from "@/components/map/novedades-mapa";
import { MapOptionsSheet } from "@/components/home/map-options-sheet";
import { StateView } from "@/components/ui/state-view";
import { CategoryIcon } from "@/components/admin/category-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading";
import { useSearchActions } from "@/providers/search-provider";
import {
  GEO_ERROR_MESSAGES,
  getCurrentPosition,
  getLastKnownPosition,
} from "@/lib/map/geolocation";
import { readMapView, saveMapView } from "@/lib/map/map-view-store";
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
import type { MapPlace, MapViewProps } from "@/components/map/types";
import { usePlaces } from "@/providers/places-provider";
import {
  FILLER_PLACE_IDS,
  placeIcon,
  type BusinessCategory,
} from "@/lib/places";
import { matchesPlaceFilters } from "@/lib/place-filters";
import { estadoVisible } from "@/lib/ficha/horario";
import { horaTexto, textoEstado } from "@/config/ficha";
import { ordenarCercaDeTi } from "@/lib/cerca-de-ti";
import { formatearBarrio, formatearDireccion, unirPartes } from "@/lib/texto-lugar";
import { hayOferta, ofertasVigentes } from "@/lib/ofertas";
import { energiaParaIA, tieneRespaldo } from "@/lib/energia";
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
  placeOutsideUserProvince,
  queryMentionsOtherProvince,
  userProvinceLabel,
} from "@/lib/user-province";
import { pushRecentSearch } from "@/lib/recent-searches-store";
import { readActivity, toggleSaved } from "@/lib/activity-store";
import { saveAiRecommendations } from "@/lib/ai-recommendation-store";
import { buscarLugaresLocales } from "@/lib/busqueda-local";
import { sharePlace } from "@/lib/share";
import { fetchMe, refreshSession } from "@/lib/session-client";
import {
  trackAiSearchCompleted,
  trackAiSearchSubmitted,
  trackCategorySelect,
  trackMapLocate,
  trackMapMarkerClick,
  trackRouteRequested,
} from "@/lib/analytics";
import { trackPlaceMetric } from "@/lib/place-metrics";

type SheetState =
  "default" | "searching" | "results" | "no-results" | "error" | "guest";

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
        }).then(refreshSession);
      },
    },
  });
}

interface HomePlace {
  id: string;
  name: string;
  isProject?: boolean;
  category: string;
  barrio: string;
  rating: number;
  distance: string;
  /** Distancia numérica para ordenar; `null` si no hay origen. */
  distanceM: number | null;
  price: string;
  /** Nombre del icono Lucide, ya resuelto con la reserva de la categoría. */
  icon: string;
  /** Logo del negocio. Manda sobre el icono en la miniatura de la tarjeta. */
  logoUrl?: string;
  tags: {
    label: string;
    variant?: "mlc" | "open" | "default";
    /** `state` permite que el texto completo cambie sin romper el color. */
    state?: "abierto" | "cerrado";
  }[];
  /** `null` = no hay horario que permita afirmar nada. */
  abierto: boolean | null;
  /** Texto único de estado: «Abierto · cierra a las 23:00», etc. */
  estadoTexto: string | null;
  /** Próxima apertura en epoch ms, para ordenar los cerrados. */
  proximaApertura: number | null;
  /** `HH:MM` de la próxima apertura, para el aviso de «todo cerrado». */
  abreA: string | null;
  /** Datos reales para los chips y filtros de «Cerca de ti». */
  domicilio: boolean;
  planta: boolean;
  aceptaCup: boolean;
  ofertaTexto: string | null;
  desc: string;
  lat: number;
  lng: number;
  boosted?: boolean;
  /** Insignia «Top del mes», ya resuelta por el servidor. Ver `TopDelMes`. */
  topDelMes?: boolean;
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
  /** Se fija después de montar: con `new Date()` en render, servidor y cliente
      pueden pintar «Abierto» y «Cerrado» distintos. */
  now: Date | null,
): HomePlace {
  /* El estado sale del horario, no de si la ficha está publicada. `status` es
     «¿el negocio existe?»: con él solo, cualquier negocio activo salía en verde
     a medianoche. Si el horario no da una hora comprobable, la tarjeta no dice
     nada —`PlaceCard` ya sabe vivir sin chip de estado—. */
  const estado = now
    ? estadoVisible({
        horario: p.horario,
        schedule: p.schedule,
        status: p.status,
        mensajeCierre: p.cerradoMensaje,
        now,
      })
    : null;
  /* `sinHorario` no es «cerrado»: es «no se puede afirmar». La tarjeta se calla
     en vez de pintar un gris que el negocio no dijo. */
  const abierto = estado && !estado.sinHorario ? estado.abierto : null;
  const estadoTexto = estado ? textoEstado(estado) : null;
  const tags: HomePlace["tags"] =
    abierto === null
      ? []
      : [
          {
            label: estadoTexto ?? (abierto ? "Abierto" : "Cerrado"),
            variant: abierto ? "open" : "default",
            state: abierto ? "abierto" : "cerrado",
          },
        ];
  if (p.selloVerificado) tags.push({ label: "Verificado", variant: "open" });
  /* Va antes que «Destacado» y «USD Clásica» a propósito: de una tarjeta se
     leen dos o tres chapitas, y una oferta que caduca hoy importa más que el
     medio de pago. */
  if (hayOferta(p.ofertas)) tags.push({ label: "Oferta", variant: "open" });
  if (p.isBoosted) tags.push({ label: "Destacado" });
  if (p.payments.includes("MLC"))
    tags.push({ label: "USD Clásica", variant: "mlc" });
  const barrio = formatearBarrio(p.barrio) || "Cuba";
  const direccion = formatearDireccion(p.address);
  const oferta = now ? ofertasVigentes(p.ofertas, now.getTime())[0] : undefined;
  return {
    id: p.id,
    name: p.name,
    isProject: p.isProject,
    category: p.category?.trim() || "Otro",
    barrio,
    rating: p.rating ?? 0,
    distanceM,
    distance:
      distanceM !== null
        ? formatDistanceM(distanceM)
        : p.distanceLabel || direccion || barrio || "Ver en el mapa",
    price: p.priceLabel || "—",
    icon: placeIcon(p.icon, p.category, categories),
    logoUrl: p.logoUrl,
    tags,
    abierto,
    estadoTexto,
    proximaApertura: estado?.proximaApertura ?? null,
    abreA: estado?.abreA ?? null,
    domicilio: p.entrega?.domicilio === true,
    planta: tieneRespaldo(p.energiaRespaldo),
    aceptaCup: p.payments.includes("CUP"),
    ofertaTexto: oferta?.titulo.trim() || null,
    desc: p.description || "Negocio agregado por su dueño en La Verde.",
    lat: p.lat,
    lng: p.lng,
    boosted: p.isBoosted,
    topDelMes: p.topDelMes,
  };
}

const FILTROS_HOJA = [
  { key: "abierto", label: "Abierto ahora" },
  { key: "domicilio", label: "A domicilio" },
  { key: "cup", label: "Acepta CUP" },
  { key: "planta", label: "Tiene planta" },
  { key: "oferta", label: "Con oferta" },
] as const;

const SHEET_TITLES: Record<SheetState, { title: string; subtitle: string }> = {
  default: { title: "Cerca de ti", subtitle: "Lugares cerca de ti" },
  searching: { title: "Buscando", subtitle: "Analizando tu consulta…" },
  results: {
    title: "Resultados",
    subtitle: "Lugares que coinciden con tu búsqueda",
  },
  "no-results": {
    title: "Sin resultados",
    subtitle: "Intenta con otra búsqueda",
  },
  error: {
    title: "Error de conexión",
    subtitle: "Verifica tu conexión a internet",
  },
  guest: {
    title: "La IA necesita una cuenta",
    subtitle: "El mapa sigue abierto para todos",
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
  liked,
  onLike,
}: {
  place: HomePlace | null;
  onClose: () => void;
  onNavigate?: (place: HomePlace) => void;
  route?: RouteResult | null;
  userLocation: { lat: number; lng: number; accuracy?: number } | null;
  liked: boolean;
  onLike: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  /* El cierre por Escape, el foco inicial y la trampa de Tab convierten la
     ficha en un diálogo de verdad: antes, con teclado, el foco se quedaba
     detrás del overlay. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!place) return;
    const previo = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const enfocables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (enfocables.length === 0) return;
      const primero = enfocables.item(0);
      const ultimo = enfocables.item(enfocables.length - 1);
      if (!primero || !ultimo) return;
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => {
      window.removeEventListener("keydown", alTeclear);
      previo?.focus?.();
    };
  }, [place]);

  return (
    <AnimatePresence>
      {place && (
        <div className="fixed inset-0 z-[400] flex flex-col">
          <motion.button
            type="button"
            aria-label="Cerrar"
            tabIndex={-1}
            className="absolute inset-0 w-full border-0 bg-ink/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={place.name}
            tabIndex={-1}
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
                ref={closeRef}
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
                  {unirPartes([place.category, place.barrio])}
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
                  className="flex flex-1 items-center justify-center gap-2 min-h-12 px-6 py-3 rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo transition-colors duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
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
                    onClick={onLike}
                    aria-pressed={liked}
                    className={cn(
                      "flex-1 size-12 rounded-full border grid place-items-center transition-colors duration-500",
                      liked
                        ? "border-verde-300 text-verde-600"
                        : "border-ink/10 text-ink-soft/75 hover:border-verde-300 hover:text-verde-600",
                    )}
                    aria-label="Favorito"
                  >
                    <Heart
                      size={18}
                      fill={liked ? "currentColor" : "none"}
                      strokeWidth={1.8}
                    />
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

function HomePageContent() {
  const searchParams = useSearchParams();
  /* Llegada desde «Ver el mapa» de la portada: la ubicación ya se pidió en ese
     toque y lo que el visitante quiere ver es su zona, no la última vista del
     mapa ni la provincia del perfil. */
  const locateOnArrival = searchParams.get("ubicacion") === "1";
  /* El SW redirige aquí cuando una ruta pública no está en caché y no hay red.
     Se muestra el banner y se borra el parámetro para que una recarga no lo repita. */
  const desdeOffline = searchParams.get("desde") === "pagina";
  useEffect(() => {
    if (!desdeOffline) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("desde");
    window.history.replaceState(null, "", url.pathname + (url.search || "") + (url.hash || ""));
  }, [desdeOffline]);
  const [sheetState, setSheetState] = useState<SheetState>("default");
  /* La búsqueda del home es una capa propia, no el desplegable de la cabecera
     global. El parámetro `buscar=1` permite que el atrás de Android la cierre
     en vez de salir de la app. */
  const [searchOpen, setSearchOpen] = useState(false);
  const busquedaInicialLeida = useRef(false);
  useEffect(() => {
    if (busquedaInicialLeida.current) return;
    busquedaInicialLeida.current = true;
    if (searchParams.get("buscar") === "1") setSearchOpen(true);
  }, [searchParams]);
  const [mapOptionsOpen, setMapOptionsOpen] = useState(false);
  const opcionesInicialesLeidas = useRef(false);
  useEffect(() => {
    if (opcionesInicialesLeidas.current) return;
    opcionesInicialesLeidas.current = true;
    if (searchParams.get("opciones") === "mapa") setMapOptionsOpen(true);
  }, [searchParams]);
  const [novedadesKey, setNovedadesKey] = useState(0);
  const [refrescando, setRefrescando] = useState(false);
  const [ubicando, setUbicando] = useState(false);
  /* La hora se fija tras montar. El primer render del cliente coincide con el
     del servidor y el chip «Abierto/Cerrado» aparece en el siguiente tick. */
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    setAhora(new Date());
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const [selectedId, setSelectedId] = useState<string>("6");
  /* Contador, no booleano: cada gesto pide otra vez bajar la hoja a su vista
     más baja —la que tiene al abrir el home— para dejar ver el mapa. Un solo
     contador para todos los gestos que la bajan: bajarla no tiene profundidades
     distintas, y con dos contadores acabaron haciendo lo mismo. */
  const [peekKey, setPeekKey] = useState(0);
  /* Contador también: cada búsqueda pide abrir la hoja de nuevo. Con solo
     `forceOpen` la segunda búsqueda no reabría nada —el booleano ya estaba en
     `true` desde la primera— y los resultados quedaban escondidos bajo la hoja
     recogida. */
  const [openKey, setOpenKey] = useState(0);
  /* Vista inclinada del mapa. El estado vive aquí y no en `MapContent` porque
     el botón que la enciende está en la columna de controles de esta página. */
  const [vista3d, setVista3d] = useState(false);
  /* Vacío al montar, nunca sembrado: el corazón tiene que decir la verdad
     mientras llega `fetchMe`. El efecto de abajo lo rellena desde la misma
     lista de guardados que usa el perfil. */
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  /* «No se sabe» no es «no hay sesión». Solo se bloquea la búsqueda cuando
     `/api/me` ha dicho que no hay cuenta; mientras no contesta, la petición
     viaja y el servidor decide. */
  const [authState, setAuthState] = useState<"unknown" | "in" | "out">(
    "unknown",
  );
  /* Categoría y filtros viven en la URL además de aquí: una vista filtrada se
     puede compartir y «atrás» devuelve a ella. Se escriben con
     `replaceState`, no con navegación de Next, para no pagar renders de
     servidor en cada chip. */
  const [activeCategory, setActiveCategory] = useState(
    () => searchParams.get("categoria") ?? "all",
  );
  /* Filtros acumulables del mapa. Viven aquí y no dentro de `PlaceFilters`
     porque es esta pantalla la que filtra: allí se encendían y no salían de
     casa. */
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    () => new Set(searchParams.getAll("filtro")),
  );
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
  /* La última vista del mapa, guardada al moverse. Entrar a una ficha o a otra
     sección desmonta el home; sin esto, al volver el mapa arrancaba en el
     centro de la provincia y se perdía el encuadre que el usuario había dejado. */
  const restoredMapView = useMemo(
    () =>
      locateOnArrival ? null : readMapView(readUserPreferences().location),
    [locateOnArrival],
  );
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(
    () => {
      if (restoredMapView) return [restoredMapView.lng, restoredMapView.lat];
      if (typeof window === "undefined") return null;
      /* La posición pedida al tocar «Ver el mapa» ya está en caché. Arranca
         ahí, sin pasar por La Habana. Sin posición, manda la provincia. */
      const cached = getLastKnownPosition();
      if (locateOnArrival) {
        return cached ? [cached.lng, cached.lat] : null;
      }
      const c = preferredLocationCenter(readUserPreferences().location);
      return (
        (c ? ([c[1], c[0]] as [number, number]) : null) ??
        (cached ? [cached.lng, cached.lat] : null)
      );
    },
  );
  /* El home no encuadra «todo Cuba» al abrir: eso era lo que dejaba zona rural
     sin pines. Arranca en la vista restaurada, en la ciudad del perfil o en La
     Habana por defecto, y deja que el GPS afine después. */
  const [disableAutoFit, setDisableAutoFit] = useState(true);
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
  const { places, categories, hydrated, refreshPlaces } = usePlaces();

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

  /* «Populares» no es una categoría de la base: es un atajo a lo que destaca
     (top del mes u oferta viva). Si no hay nada, el chip no se pinta. */
  const hayPopulares = useMemo(
    () => places.some((p) => p.topDelMes || hayOferta(p.ofertas)),
    [places],
  );

  useEffect(() => {
    let alive = true;
    const resolveInitialCenter = (
      prefs: UserPreferences | null,
    ): [number, number] | null => {
      const profileCenter = preferredLocationCenter(prefs?.location);
      if (profileCenter) return [profileCenter[1], profileCenter[0]];

      const cached = getLastKnownPosition();
      return cached ? [cached.lng, cached.lat] : null;
    };

    fetchMe<{
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
    }>()
      .then((data) => {
        if (!alive) return;

        const resolvedId = data.authenticated ? (data.user?.id ?? null) : null;
        setUserId(resolvedId);
        setAuthState(data.authenticated ? "in" : "out");
        setLikedIds(new Set(readActivity(resolvedId).savedIds));

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
          /* Con una vista restaurada no se recoloca el mapa: la vuelta tiene
             que enseñar exactamente lo que se dejó, no la ciudad del perfil. */
          if (preferredCenter && !restoredMapView && !locateOnArrival) {
            setInitialCenter(preferredCenter);
            setDisableAutoFit(true);
          }
          return;
        }

        setHasSavedProfileLocation(false);
        const fallbackPrefs = readUserPreferences();
        setUserPreferences(fallbackPrefs);
        const fallbackCenter = resolveInitialCenter(fallbackPrefs);
        if (fallbackCenter && !restoredMapView && !locateOnArrival) {
          setInitialCenter(fallbackCenter);
          setDisableAutoFit(true);
        }
      })
      .catch(() => {
        setUserId(null);
        setLikedIds(new Set(readActivity(null).savedIds));
        setHasSavedProfileLocation(false);
        const fallbackPrefs = readUserPreferences();
        setUserPreferences(fallbackPrefs);
        const fallbackCenter = resolveInitialCenter(fallbackPrefs);
        if (fallbackCenter && !restoredMapView && !locateOnArrival) {
          setInitialCenter(fallbackCenter);
          setDisableAutoFit(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  /* Safari restaura el home desde bfcache con el `authState` de la visita
     anterior: quien acaba de entrar seguía viendo el aviso de invitado, y
     quien había cerrado sesión seguía con el suyo. Se vuelve a preguntar sin
     recargar la página. */
  useEffect(() => {
    function alRestaurar(evento: PageTransitionEvent) {
      if (!evento.persisted) return;
      refreshSession();
      void fetchMe<{
        authenticated?: boolean;
        user?: { id?: string } | null;
      }>()
        .then((data) => {
          const id = data.authenticated ? (data.user?.id ?? null) : null;
          setUserId(id);
          setAuthState(data.authenticated ? "in" : "out");
          setLikedIds(new Set(readActivity(id).savedIds));
        })
        .catch(() => {});
    }
    window.addEventListener("pageshow", alRestaurar);
    return () => window.removeEventListener("pageshow", alRestaurar);
  }, []);

  const syncFilterUrl = useCallback(
    (categoria: string, filtros: Set<string>) => {
      const url = new URL(window.location.href);
      if (categoria === "all") url.searchParams.delete("categoria");
      else url.searchParams.set("categoria", categoria);
      url.searchParams.delete("filtro");
      filtros.forEach((f) => url.searchParams.append("filtro", f));
      window.history.replaceState(null, "", url);
    },
    [],
  );

  /* Un filtro se enciende o se apaga en un solo sitio para que el mapa, la
     lista, la hoja y la URL no puedan discrepar. */
  const toggleFilter = useCallback(
    (filtro: string) => {
      setActiveFilters((previos) => {
        const siguientes = new Set(previos);
        if (siguientes.has(filtro)) siguientes.delete(filtro);
        else siguientes.add(filtro);
        syncFilterUrl(activeCategory, siguientes);
        return siguientes;
      });
    },
    [activeCategory, syncFilterUrl],
  );

  /* Abrir la búsqueda deja una entrada en el historial para que el gesto de
     atrás la cierre. No se usa el router de Next: la pantalla es una capa, no
     una ruta nueva, y no debe volver a pedir el catálogo. */
  const abrirBuscar = useCallback(() => {
    setSearchOpen(true);
    const url = new URL(window.location.href);
    if (url.searchParams.get("buscar") !== "1") {
      url.searchParams.set("buscar", "1");
      window.history.pushState(
        { ...(window.history.state ?? {}), lvBuscar: true },
        "",
        url,
      );
    }
  }, []);

  const cerrarBuscar = useCallback(() => {
    setSearchOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.get("buscar") !== "1") return;
    if (window.history.state?.lvBuscar) {
      window.history.back();
      return;
    }
    url.searchParams.delete("buscar");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const abrirOpcionesMapa = useCallback(() => {
    setMapOptionsOpen(true);
    const url = new URL(window.location.href);
    if (url.searchParams.get("opciones") !== "mapa") {
      url.searchParams.set("opciones", "mapa");
      window.history.pushState(
        { ...(window.history.state ?? {}), lvOpciones: true },
        "",
        url,
      );
    }
  }, []);

  const cerrarOpcionesMapa = useCallback(() => {
    setMapOptionsOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.get("opciones") !== "mapa") return;
    if (window.history.state?.lvOpciones) {
      window.history.back();
      return;
    }
    url.searchParams.delete("opciones");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    function alVolver() {
      setSearchOpen(false);
      setMapOptionsOpen(false);
    }
    window.addEventListener("popstate", alVolver);
    return () => window.removeEventListener("popstate", alVolver);
  }, []);

  /* Un solo filtrado para los dos sitios que pintan el catálogo —los pines del
     mapa y la lista del panel inferior—, para que no puedan discrepar. El chip
     de categoría se encendía y no filtraba nada: `activeCategory` no lo leía
     nadie. */
  const filterContext = useMemo(
    () => ({
      categoryLabel:
        activeCategory === "all" || activeCategory === "populares"
          ? null
          : (categories.find((c) => c.value === activeCategory)?.label ?? null),
      populares: activeCategory === "populares",
      filters: activeFilters,
      origin: userLocation,
      /* Se evalúa al filtrar, no en cada render: «Abiertos ahora» cambia con la
         hora, pero no hace falta recalcularlo cada segundo. Antes de montar se
         usa una fecha fija para que el HTML no dependa de la zona del proceso. */
      now: ahora ?? new Date(0),
    }),
    [activeCategory, categories, activeFilters, userLocation, ahora],
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
     colarse en los pines.

     Las fichas de relleno se caen aquí y solo aquí: siguen dibujando su pin en
     el mapa, pero no se recomiendan. */
  const listVisiblePlaces = useMemo(
    () =>
      provinceScopedPlaces.filter(
        (p) =>
          !FILLER_PLACE_IDS.has(p.id) && matchesPlaceFilters(p, filterContext),
      ),
    [provinceScopedPlaces, filterContext],
  );

  const mapPlaces = useMemo<MapPlace[]>(
    () =>
      mapVisiblePlaces.map((p) => {
        const estado = ahora
          ? estadoVisible({
              horario: p.horario,
              schedule: p.schedule,
              status: p.status,
              mensajeCierre: p.cerradoMensaje,
              now: ahora,
            })
          : null;
        return {
        id: p.id,
        name: p.name,
        isProject: p.isProject,
        lat: p.lat,
        lng: p.lng,
        category: p.category,
        abierto:
          estado && !estado.sinHorario ? estado.abierto : null,
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
        };
      }),
    [mapVisiblePlaces, categories, ahora],
  );

  /* Origen para medir cercanía: el GPS si lo hay y, si no, el centro de la
     provincia del perfil. Antes el fallback no existía y la lista quedaba
     sin orden para quien no había dado permiso de ubicación — el mismo
     criterio que ya usa el desplegable de sugerencias del header.

     Vive fuera de `filteredPlaces` porque también lo necesita `resultPlaces`
     para las tarjetas que no pasan por la lista recortada por provincia. */
  const distanceOrigin = useMemo(() => {
    const profileCenter = preferredLocationCenter(userPreferences?.location);
    return (
      userLocation ??
      getLastKnownPosition() ??
      (profileCenter ? { lat: profileCenter[0], lng: profileCenter[1] } : null)
    );
  }, [userLocation, userPreferences]);

  const filteredPlaces = useMemo<HomePlace[]>(() => {
    const origin = distanceOrigin;
    const ranked = userPreferences
      ? personalizePlaces(listVisiblePlaces, userPreferences)
      : listVisiblePlaces;

    /* Primero lo abierto y más cercano; después lo cerrado por lo que abre
       antes. El orden se hace aquí, en el cliente, porque la lista y la hora
       viven aquí; el servidor no necesita saber nada de «Cerca de ti». */
    const mapped = ranked.map((place) =>
      userPlaceToHomePlace(
        place,
        categories,
        origin ? haversineM(origin, { lat: place.lat, lng: place.lng }) : null,
        ahora,
      ),
    );

    return ordenarCercaDeTi(mapped);
  }, [listVisiblePlaces, categories, distanceOrigin, userPreferences, ahora]);

  const handleLike = useCallback(
    (id: string) => {
      const saved = toggleSaved(id, userId);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (saved) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [userId],
  );

  // Tocar el fondo del mapa quita la selección, como en cualquier mapa.
  const handleDeselect = useCallback(() => {
    setSelectedId("");
  }, []);

  const handleSearch = useCallback(
    async (query: string) => {
      /* Invitado: el mapa se explora, pero la IA es de cuentas. Se le dice
         justo al intentarlo, sin gastar una petición ni una llamada al modelo. */
      if (authState === "out") {
        setSearchingQuery(query);
        setOpenKey((k) => k + 1);
        setSheetState("guest");
        return;
      }

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
      /* Con la conexión declarada lenta no se esperan 28 s a la IA: a los 8 s
         se cae a la búsqueda local. */
      const timeout = setTimeout(
        () => controller.abort(),
        conexionLenta() ? 8000 : 28000,
      );
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
        /* Las fichas de relleno también se quedan fuera del catálogo de la IA:
           `listVisiblePlaces` ya no las recomienda, pero este catálogo se
           armaba desde `places` y el modelo las seguía proponiendo. */
        const recommendable = places.filter(
          (p) => !FILLER_PLACE_IDS.has(p.id),
        );
        const pool =
          province && !mentionsOther
            ? recommendable.filter((p) => !placeOutsideUserProvince(p, province))
            : recommendable;

        const catalog = (pool.length > 0 ? pool : recommendable)
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
            /* La carta ya no viaja desde aquí: `/api/ai/search` la arma en el
               servidor con los ids, desde la tabla de productos. El catálogo
               público no la trae y así nadie puede colar texto en el prompt. */
            /* La energía va en palabras y **solo cuando hay algo que decir**:
               `energiaParaIA` calla el «ninguna» y el hueco, porque contarle al
               modelo «este NO tiene corriente» en una consulta que busca sitios
               con corriente solo sirve para que lo descarte dos veces. Ver
               `src/lib/energia.ts`. */
            energia: energiaParaIA(p.energiaRespaldo) ?? undefined,
            /* Si se le puede pedir al negocio ahora mismo. Solo viaja en `true`:
               ausente = no hay forma de pedir y el filtro del servidor no lo
               recomienda para consultas de pedido. */
            pedidos: p.pedidosHabilitado === true ? true : undefined,
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
        /* El servidor manda: si la sesión no vale, se enseña el aviso aunque
           `/api/me` todavía no hubiera contestado. */
        if (res.status === 401) {
          setSheetState("guest");
          return;
        }
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
      } catch (error) {
        trackAiSearchCompleted(query, 0, "error");
        const sinRed = !navigator.onLine;
        const agotada = error instanceof DOMException && error.name === "AbortError";

        /* Sin red, con red lenta o con la petición agotada: la IA no puede
           contestar, pero el catálogo guardado sí. Se buscan los mismos lugares
           en local y se dice de dónde salen los resultados. */
        if (sinRed || agotada || conexionLenta()) {
          const locales = buscarLugaresLocales(places, query);
          void import("sonner").then(({ toast }) => {
            toast(
              sinRed
                ? "Sin conexión: mostrando resultados guardados."
                : "Conexión lenta: mostrando resultados guardados.",
              { duration: 4000 },
            );
          });

          if (locales.length > 0) {
            saveAiRecommendations(query, locales);
            setAiState({
              matches: locales,
              summary: `Resultados guardados para «${query}». La búsqueda con IA vuelve cuando la conexión mejore.`,
            });
            setSheetState("results");
          } else {
            setSheetState("no-results");
          }
          return;
        }

        setSheetState("error");
      } finally {
        clearTimeout(timeout);
        searchCtx.setIsSearching(false);
      }
    },
    [authState, places, searchCtx, userLocation, userPreferences],
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

  /* El buscador abre sus sugerencias y la hoja se aparta. El desplegable sale
     por debajo de ella —la hoja va en z-300 y él en z-250—, así que con la hoja
     de recomendaciones delante media lista quedaba tapada. Baja a su vista más
     baja —la de apertura—: el gesto aquí no es sobre el mapa, y esconder la
     sección entera se lee como que se cerró. */
  useEffect(() => {
    searchCtx.registerSuggestionsHandler(() => setPeekKey((k) => k + 1));
  }, [searchCtx]);

  /* «Quitar» de la búsqueda activa: vuelve a «Cerca de ti» sin pedir nada.
     El catálogo ya está en memoria; refrescarlo aquí gastaría datos por un
     gesto que solo quiere ver la lista de siempre. */
  const handleClearSearch = useCallback(() => {
    setAiState(null);
    setSearchingQuery("");
    setSheetState("default");
    setOpenKey((k) => k + 1);
  }, []);

  const handleResetFilters = useCallback(() => {
    const vacios = new Set<string>();
    setActiveFilters(vacios);
    setActiveCategory("all");
    syncFilterUrl("all", vacios);
    if (searchingQuery) handleClearSearch();
  }, [syncFilterUrl, searchingQuery, handleClearSearch]);

  const handleVerDomicilio = useCallback(() => {
    if (!activeFilters.has("domicilio")) toggleFilter("domicilio");
  }, [activeFilters, toggleFilter]);

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

  /* Tocar un pin lo selecciona, lo sube por encima de la hoja y abre su
     ventana. El popup sale del propio pin; la cámara se mueve con padding para
     que no quede debajo de la hoja. */
  const handleMarkerClick = useCallback(
    (id: string) => {
      trackMapMarkerClick(id);
      trackPlaceMetric(id, "map_click");
      setSelectedId(id);
      const place = places.find((p) => p.id === id);
      if (place) {
        setFocusTarget((prev) => ({
          lat: place.lat,
          lng: place.lng,
          key: (prev?.key ?? 0) + 1,
        }));
      }
      setPeekKey((k) => k + 1);
    },
    [places],
  );

  /* Envuelta estable para el mapa: `MapMarkers` memoriza cada pin y compara
     `onSelect` por identidad. Con la flecha escrita en el JSX, cada cambio de
     estado del home —abrir la hoja, tocar un filtro, escribir— re-renderizaba
     los doscientos pines y recreaba su icono. */
  const handlePlaceSelect = useCallback(
    (place: MapPlace) => handleMarkerClick(place.id),
    [handleMarkerClick],
  );

  /* Vuela el mapa hasta un lugar al tocar su botón de ubicación —el 📍 "Ver en
     el mapa" de la card—, lo resalta y baja la hoja a su vista más baja. Las
     tres cosas van juntas: sin vuelo no se llega, sin resaltado el pin se pierde
     entre los demás, y sin bajarla el negocio queda justo detrás de la lista. */
  const handleLocate = useCallback((place: HomePlace) => {
    trackMapLocate(place.id);
    setSelectedId(place.id);
    setFocusTarget((prev) => ({
      lat: place.lat,
      lng: place.lng,
      key: (prev?.key ?? 0) + 1,
    }));
    setPeekKey((k) => k + 1);
  }, []);

  const handleUserLocated = useCallback(
    (lat: number, lng: number, accuracy?: number) => {
      setUserLocation({ lat, lng, accuracy });
      setSheetState("default");
    },
    [],
  );

  /* El botón de ubicación vive en la columna flotante del home. La cámara la
     mueve `MapContent` cuando cambia `userLocation`; aquí solo se pide el GPS
     y se avisa si no hay permiso. */
  const handleUbicar = useCallback(async () => {
    if (ubicando) return;
    setUbicando(true);
    try {
      const pos = await getCurrentPosition({ useCache: false });
      handleUserLocated(pos.lat, pos.lng, pos.accuracy);
    } catch (err) {
      const code = (err as { code?: string }).code as
        | keyof typeof GEO_ERROR_MESSAGES
        | undefined;
      toast.error(
        GEO_ERROR_MESSAGES[code ?? "unknown"] ?? GEO_ERROR_MESSAGES.unknown,
      );
    } finally {
      setUbicando(false);
    }
  }, [handleUserLocated, ubicando]);

  const handleActualizar = useCallback(async () => {
    if (refrescando) return;
    setRefrescando(true);
    try {
      await refreshPlaces();
    } finally {
      setRefrescando(false);
    }
  }, [refreshPlaces, refrescando]);

  /* También estable: `MapEventsHandler` vuelve a suscribir `moveend` cuando
     cambia la identidad de la función, y esta se recreaba en cada render. */
  const handleMapMove = useCallback<NonNullable<MapViewProps["onMapMove"]>>(
    (_bounds, center, zoom) => {
      saveMapView(center[0], center[1], zoom, readUserPreferences().location);
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
      return found ? userPlaceToHomePlace(found, categories, null, ahora) : null;
    },
    [places, categories, ahora],
  );

  /* Tercera función estable del mapa. Era una flecha en el JSX y bastaba para
     que `MapMarkers` perdiera la memoria de sus pines: cambiaba de identidad en
     cada render del home y arrastraba consigo el icono de cada marcador. */
  const handlePlaceRoute = useCallback(
    (place: MapPlace) => {
      const target = placeById(place.id);
      if (target) handleRouteFromPopup(target);
    },
    [placeById, handleRouteFromPopup],
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
    const lc =
      userPreferences.onboardingCompleted && userPreferences.location !== "otra"
        ? locationCenter(userPreferences.location)
        : null;
    const preferredCenter: [number, number] | null = lc
      ? [lc[1], lc[0]]
      : cached
        ? [cached.lng, cached.lat]
        : null;

    if (preferredCenter && !restoredMapView && !locateOnArrival) {
      setInitialCenter(preferredCenter);
      setDisableAutoFit(true);
    }
  }, [userPreferences, restoredMapView, locateOnArrival]);

  // Request location once when the home view loads, so the first map shown is
  // the user's local area (works on desktop and mobile). We first apply the
  // last known position from cache (so the map already opens centered on the
  // user), then request the real current position to refine it. Errors produce
  // a hint; the floating "Mi ubicación" button handles explicit requests.
  useEffect(() => {
    // Con onboarding completado y una provincia guardada, la primera vista es
    // SIEMPRE la ciudad elegida. El cache de geolocalización solo sirve como
    // respaldo y no debe desplazar el mapa sobre esa elección.
    //
    // Y con una vista restaurada tampoco: el GPS volaría el mapa desde donde
    // lo dejó el usuario —el regreso perdería el encuadre otra vez—. El botón
    // «Mi ubicación» sigue pidiéndola cuando se quiera.
    if (!userPreferences) return;
    /* «Ver el mapa» pide la ubicación aunque el perfil ya tenga provincia:
       quien pulsó el botón pidió ver su zona, no la ciudad guardada. */
    if (!locateOnArrival && (hasSavedProfileLocation || restoredMapView)) {
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

    /* Al llegar de «Ver el mapa» la lectura recién tomada sirve; pedir otro
       fix retrasa el centrado y gasta batería sin mejorar nada. */
    getCurrentPosition({ useCache: locateOnArrival })
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
  }, [
    handleUserLocated,
    hasSavedProfileLocation,
    userPreferences,
    restoredMapView,
    locateOnArrival,
  ]);

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

  // En resultados, muestra SOLO los lugares que la IA eligió, respetando su orden.
  // En la vista por defecto (sin búsqueda) muestra todo el catálogo.
  const resultPlaces = useMemo<HomePlace[]>(() => {
    if (!aiState || aiState.matches.length === 0) return filteredPlaces;
    const byId = new Map(filteredPlaces.map((p) => [p.id, p]));
    /* Los filtros de la hoja también mandan sobre los resultados de la IA. Si
       hay alguno activo no se rellena desde el catálogo entero: sería colar
       fichas que el filtro acaba de quitar. */
    const conFiltros =
      activeFilters.size > 0 || activeCategory !== "all";
    if (!conFiltros) {
      /* Respaldo con el catálogo entero: cuando la consulta nombra otra
         provincia, la búsqueda viaja con todos los lugares y el modelo puede
         devolver uno que la lista recortada por provincia ya descartó. Sin
         esto, la respuesta de la IA lo mencionaba y su tarjeta no salía. */
      for (const p of places) {
        if (byId.has(p.id)) continue;
        const distanceM = distanceOrigin
          ? haversineM(distanceOrigin, { lat: p.lat, lng: p.lng })
          : null;
        byId.set(p.id, userPlaceToHomePlace(p, categories, distanceM, ahora));
      }
    }
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
  }, [
    aiState,
    filteredPlaces,
    places,
    categories,
    distanceOrigin,
    activeFilters,
    activeCategory,
    ahora,
  ]);
  const recommendationCount = filteredPlaces.length;
  const listaDeLaHoja = sheetState === "results" ? resultPlaces : filteredPlaces;
  const abiertosAhora = listaDeLaHoja.filter(
    (place) => place.abierto === true,
  ).length;
  const todoCerrado =
    listaDeLaHoja.length > 0 &&
    listaDeLaHoja.every((place) => place.abierto === false);
  const hayFiltrosActivos =
    activeFilters.size > 0 || activeCategory !== "all" || Boolean(searchingQuery);
  const shownCount =
    sheetState === "results" ? resultPlaces.length : recommendationCount;

  /* El aviso de «todo cerrado» usa la primera apertura conocida y los dos
     negocios que abren a esa misma hora. Si no hay hora, no inventa el aviso. */
  const primeraApertura = listaDeLaHoja.find((place) => place.abreA);
  const horaPrimeraApertura = primeraApertura?.abreA
    ? horaTexto(primeraApertura.abreA)
    : null;
  const abrenALaMismaHora = primeraApertura
    ? listaDeLaHoja
        .filter((place) => place.abreA === primeraApertura.abreA)
        .slice(0, 2)
        .map((place) => place.name)
    : [];

  const sheetSubtitle =
    sheetState === "results" && searchingQuery
      ? `Resultados para "${searchingQuery}"`
      : sheetState === "default"
        ? !hydrated
          ? "Lugares cerca de ti"
          : todoCerrado
            ? "Todo cerrado a esta hora · ordenado por lo que abre antes"
            : `${abiertosAhora} abiertos ahora · primero lo abierto y más cercano`
        : sheetInfo.subtitle;

  /* `top` y no `pt`: `MapView` es `absolute inset-0` y un hijo absoluto toma
     como origen el borde de padding, así que el `padding-top` no lo movía. El
     mapa arrancaba en y=0 y los chips de categoría, a 8 px, quedaban detrás
     del header fijo: invisibles y sin poder tocarse. */
  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--header-h)] font-lv text-ink">
      <HomeTopBar onOpenSearch={abrirBuscar} />
      {desdeOffline && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-x-0 top-0 z-[300] flex items-center justify-center gap-2 bg-ink/85 px-4 py-2 text-[13px] font-medium text-white backdrop-blur-sm"
        >
          <WifiOff size={13} strokeWidth={2} aria-hidden />
          <span>Esta página no está guardada. Aquí tienes el mapa con lo que sí tienes guardado.</span>
        </div>
      )}
      <MapView
        ref={mapRef}
        places={mapPlaces}
        selectedPlaceId={selectedId}
        initialCenter={initialCenter ?? undefined}
        initialZoom={restoredMapView?.zoom ?? (disableAutoFit ? 13 : undefined)}
        disableAutoFit={disableAutoFit}
        vista3d={vista3d}
        onVista3dChange={setVista3d}
        /* Cada vez que el mapa se asienta se guarda dónde quedó: es lo que se
           restaura al volver desde otra sección o desde una ficha. La lectura
           síncrona de preferencias da la provincia ya guardada, también
           después de cambiarla en Ajustes. */
        onMapMove={handleMapMove}
        onPlaceSelect={handlePlaceSelect}
        onMapClick={handleDeselect}
        onPlaceRoute={handlePlaceRoute}
        userLocation={userLocation}
        onUserLocated={handleUserLocated}
        showLocateControl={false}
        focusTarget={focusTarget}
        focusPadding={140}
        viewTarget={viewTarget}
        route={route}
        routeOrigin={routeOrigin}
        routePlaceId={routeDest?.id ?? null}
        onRouteClear={handleClearRoute}
      >
        <CategoryBar
          categories={categoriesWithPlaces}
          showPopulares={hayPopulares || activeCategory === "populares"}
          active={activeCategory}
          onSelect={(value) => {
            setActiveCategory(value);
            trackCategorySelect(value);
            syncFilterUrl(value, activeFilters);
          }}
        />
        {/* La columna flotante queda en tres: notificaciones, ubicación y
            opciones. Actualizar, 3D y tema se mudaron a «Opciones del mapa» o
            al perfil; el fuego de Novedades vive dentro de esas opciones. */}
        <div className="absolute right-gutter top-[64px] z-30 flex flex-col items-end gap-[10px]">
          <MapNotifications />
          <button
            type="button"
            onClick={() => void handleUbicar()}
            disabled={ubicando}
            aria-label="Centrar en mi ubicación"
            aria-busy={ubicando}
            className={cn(
              "grid size-11 place-items-center rounded-full border border-ink/10 bg-white text-ink shadow-soft transition-colors duration-300 hover:border-verde-300 hover:text-verde-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400 disabled:cursor-wait disabled:opacity-70",
              ubicando && "text-verde-600",
            )}
          >
            {ubicando ? (
              <RefreshCw size={18} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <Navigation size={18} strokeWidth={1.8} />
            )}
          </button>
          <button
            type="button"
            onClick={abrirOpcionesMapa}
            aria-label="Opciones del mapa"
            aria-haspopup="dialog"
            className="grid size-11 place-items-center rounded-full border border-ink/10 bg-white text-ink shadow-soft transition-colors duration-300 hover:border-verde-300 hover:text-verde-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
          >
            <Layers size={18} strokeWidth={1.8} />
          </button>
        </div>
      </MapView>

      <NovedadesMapa
        hideTrigger
        openSignal={novedadesKey}
        ubicacion={userLocation}
        provincia={userProvinceLabel(userPreferences)}
        userId={userId}
      />

      <MapOptionsSheet
        open={mapOptionsOpen}
        onClose={cerrarOpcionesMapa}
        soloAbierto={activeFilters.has("abierto")}
        onToggleSoloAbierto={() => toggleFilter("abierto")}
        vista3d={vista3d}
        onToggleVista3d={() => setVista3d((activa) => !activa)}
        onNovedades={() => {
          cerrarOpcionesMapa();
          setNovedadesKey((k) => k + 1);
        }}
        onRefrescar={() => void handleActualizar()}
        refrescando={refrescando}
      />

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
          resultados tiene que poder bajarse —pin 📍 o card tocada— para
          dejar ver el mapa y el negocio, igual que en la vista inicial. Con
          `!== "default"` la guarda de forceOpen seguía viva en `results` y la
          bajada no hacía nada después de una búsqueda. */}
      <BottomSheet
        className="home-bottom-sheet"
        title={sheetInfo.title}
        subtitle={sheetSubtitle}
        badge={showBadge ? String(shownCount) : undefined}
        action={(estado, alternar) =>
          sheetState === "searching" ? undefined : (
            <button
              type="button"
              onClick={alternar}
              className="-my-2 -mr-[10px] inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-white px-3 font-lv-display text-meta font-semibold text-ink transition-colors duration-300 hover:border-verde-300 hover:bg-verde-50"
            >
              {estado === "full" ? "Ver mapa" : "Ver lista"}
            </button>
          )
        }
        defaultState="mid"
        forceOpen={sheetState === "searching"}
        peekSignal={peekKey}
        openSignal={openKey}
      >
        {/* La consulta que se llevó a la IA. Va fuera del bloque de lista para
            que también se lea cuando no hay resultados. */}
        {(sheetState === "results" || sheetState === "no-results") &&
          searchingQuery && (
            <div className="mb-gap-sm flex items-center gap-gap-xs rounded-2xl border border-verde-200 bg-verde-50 px-3 py-2">
              <p className="min-w-0 flex-1 truncate text-small text-verde-800">
                La IA buscó:{" "}
                <span className="font-semibold">«{searchingQuery}»</span>
              </p>
              <button
                type="button"
                onClick={handleClearSearch}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-verde-200 bg-white px-3 font-lv-display text-small font-semibold text-verde-700 transition-colors duration-300 hover:bg-verde-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
              >
                Quitar
              </button>
            </div>
          )}

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
              {/* Filtros de un toque. No hay chips muertos: todos se calculan
                  con datos reales de la ficha. */}
              <div className="scrollbar-hide -mx-gutter mb-gap-sm flex gap-gap-xs overflow-x-auto px-gutter pb-[2px]">
                {FILTROS_HOJA.map((filtro) => {
                  const activo = activeFilters.has(filtro.key);
                  return (
                    <button
                      key={filtro.key}
                      type="button"
                      onClick={() => toggleFilter(filtro.key)}
                      aria-pressed={activo}
                      className={cn(
                        "inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 font-lv-display text-meta font-semibold transition-colors duration-300",
                        activo
                          ? "border-verde-300 bg-verde-50 text-verde-700"
                          : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-700",
                      )}
                    >
                      {filtro.label}
                    </button>
                  );
                })}
              </div>

              {/* Sugerencia de búsqueda: sustituye la tarjeta de texto de la
                  IA. Es una frase de ejemplo, no un dato. */}
              {sheetState === "default" && !searchingQuery && !todoCerrado && (
                <button
                  type="button"
                  onClick={() =>
                    void handleSearch("dónde desayunar ahora que acepte CUP")
                  }
                  className="mb-gap-sm flex min-h-11 w-full items-center gap-gap-xs rounded-2xl border border-dashed border-verde-300 bg-verde-50/60 px-3 py-2 text-left font-lv text-small text-verde-800 transition-colors duration-300 hover:border-verde-400 hover:bg-verde-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
                >
                  <Sparkles
                    size={18}
                    strokeWidth={1.8}
                    aria-hidden
                    className="shrink-0 text-verde-700"
                  />
                  <span className="min-w-0">
                    Prueba:{" "}
                    <span className="font-semibold">
                      «dónde desayunar ahora que acepte CUP»
                    </span>
                  </span>
                </button>
              )}

              {sheetState === "default" &&
                todoCerrado &&
                !activeFilters.has("abierto") && (
                  <div className="mb-gap-sm flex flex-col gap-gap-xs rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="font-lv-display text-small font-semibold text-amber-800">
                      A esta hora no hay nada abierto cerca
                    </p>
                    {horaPrimeraApertura && abrenALaMismaHora.length > 0 && (
                      <p className="text-meta leading-relaxed text-amber-800">
                        Lo primero abre a las {horaPrimeraApertura}:{" "}
                        {abrenALaMismaHora.join(" y ")}.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleVerDomicilio}
                      className="mt-1 inline-flex min-h-11 self-start items-center justify-center rounded-full border border-amber-200 bg-white px-4 font-lv-display text-small font-semibold text-amber-800 transition-colors duration-300 hover:bg-amber-50"
                    >
                      Ver quién lleva a domicilio
                    </button>
                  </div>
                )}

              {/* Place list. Mientras el catálogo llega de la base, skeletons
                  con la forma de las tarjetas: sin esto el sheet contaba
                  «0 lugares» y el mapa arrancaba sin pines hasta que la
                  respuesta aterrizaba de golpe. */}
              <div className="flex flex-col gap-[10px]" aria-busy={!hydrated}>
                {!hydrated &&
                  [1, 2, 3].map((i) => (
                    <div
                      key={`sk-${i}`}
                      className="flex gap-[12px] rounded-2xl border border-ink/5 p-3"
                    >
                      <Skeleton className="size-[52px] rounded-lv-lg shrink-0" />
                      <div className="flex-1 flex flex-col gap-2 pt-1">
                        <Skeleton className="h-[14px] w-[65%]" />
                        <Skeleton className="h-[12px] w-[40%]" />
                        <Skeleton className="h-[12px] w-[85%]" />
                      </div>
                    </div>
                  ))}
                {hydrated &&
                  listaDeLaHoja.map((place) => (
                    <div
                      key={place.id}
                      className="[content-visibility:auto] [contain-intrinsic-size:auto_88px]"
                    >
                      <LugarCercanoCard
                        place={place}
                        selected={selectedId === place.id}
                        liked={likedIds.has(place.id)}
                        onLike={() => handleLike(place.id)}
                        onSelect={() => handleLocate(place)}
                      />
                    </div>
                  ))}
              </div>

              {hydrated && listaDeLaHoja.length === 0 && (
                <div className="flex flex-col items-center gap-gap-xs px-3 py-6 text-center">
                  <p className="text-small text-ink-soft/75">
                    {hayFiltrosActivos
                      ? "Nada cerca con estos filtros."
                      : "No hay lugares cerca por ahora."}
                  </p>
                  {hayFiltrosActivos && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex min-h-11 items-center justify-center rounded-full bg-verde-400 px-5 font-lv-display text-small font-semibold text-verde-950 transition-colors duration-300 hover:bg-verde-300"
                    >
                      Quitar filtros
                    </button>
                  )}
                </div>
              )}
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
                    className="px-3.5 py-2 rounded-full border border-ink/10 bg-white font-lv-display text-small font-medium text-ink-soft/75 transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600"
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

        {/* Guest state: el mapa es libre, la búsqueda con IA no. */}
        {sheetState === "guest" && (
          <AnimatePresence mode="wait">
            <motion.div
              key="guest"
              variants={popIn}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -14, transition: { duration: 0.2 } }}
            >
              <div className="flex flex-col items-center px-2 pb-2 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-verde-50 text-verde-700">
                  <Lock size={22} strokeWidth={1.8} aria-hidden />
                </span>
                <h3 className="mt-4 font-lv-display text-lg font-bold tracking-[-0.02em] text-ink">
                  La búsqueda con IA necesita una cuenta
                </h3>
                <p className="mt-2 max-w-[40ch] text-small leading-relaxed text-ink-soft/75 text-pretty">
                  Puedes explorar el mapa, las fichas y las recomendaciones sin
                  iniciar sesión. Para buscar en lenguaje natural, entra o crea
                  tu cuenta.
                </p>
                <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row">
                  <Link
                    href="/login?next=%2Fhome"
                    className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-verde-400 px-5 font-lv-display text-small font-semibold text-verde-950 transition-colors duration-500 hover:bg-verde-300"
                  >
                    Iniciar sesión
                  </Link>
                  <Link
                    href="/register?next=%2Fhome"
                    className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-ink/15 px-5 font-lv-display text-small font-semibold text-ink transition-colors duration-500 hover:border-ink/30 hover:bg-sand"
                  >
                    Crear cuenta
                  </Link>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </BottomSheet>

      {/* Detail overlay */}
      <DetailOverlay
        place={detailPlace}
        liked={detailPlace ? likedIds.has(detailPlace.id) : false}
        onLike={() => {
          if (detailPlace) handleLike(detailPlace.id);
        }}
        onClose={() => {
          setDetailPlace(null);
          handleClearRoute();
        }}
        onNavigate={handleNavigate}
        route={route}
        userLocation={userLocation}
      />

      <HomeSearchOverlay
        open={searchOpen}
        onClose={cerrarBuscar}
        onSearch={handleSearch}
      />
    </div>
  );
}

/**
 * ¿El navegador declara la conexión lenta?
 *
 * Chromium la expone en `navigator.connection`; Safari/iOS no, y allí se
 * responde `false` (se espera a la IA como siempre). El ahorro de datos cuenta
 * como lenta: quien lo activó no quiere gastar en una espera larga.
 */
function conexionLenta(): boolean {
  const conexion = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!conexion) return false;
  if (conexion.saveData) return true;
  return (
    conexion.effectiveType === "slow-2g" ||
    conexion.effectiveType === "2g" ||
    conexion.effectiveType === "3g"
  );
}

/**
 * El primer pintado del home, sin JavaScript de por medio.
 *
 * Es el respaldo de `Suspense`, así que es lo que el servidor manda dentro del
 * HTML: en una conexión lenta el visitante ve esto mientras baja el bundle, en
 * vez del rectángulo de arena vacío de antes. Tiene la forma del home real
 * —chips arriba, mapa detrás y la hoja asomando— para que cuando llegue el
 * contenido no se mueva nada de sitio.
 *
 * La hoja imita su vista de reposo media (la misma `min(430px, 55vh)` de
 * `BottomSheet`): si el
 * esqueleto la pintara abierta, el home daría un salto al montar.
 */
function HomeShellSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Cargando el mapa y los lugares"
      className="fixed inset-x-0 bottom-0 top-[var(--header-h)] overflow-hidden bg-sand-deep"
    >
      {/* La barra del home también tiene esqueleto: el layout global ya no la
          pinta en `/home`, y sin esto el primer pintado dejaba 60 px vacíos. */}
      <div className="safe-top fixed inset-x-0 top-0 z-200 flex h-header items-center gap-2 border-b border-ink/5 bg-sand-warm/90 px-3">
        <div className="skeleton-shimmer size-[26px] rounded-full" />
        <div className="skeleton-shimmer h-11 flex-1 rounded-full" />
        <div className="skeleton-shimmer size-11 rounded-full" />
      </div>

      {/* El mapa, insinuado: una retícula tenue en vez de un color plano. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(8,19,13,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(8,19,13,0.05)_1px,transparent_1px)] [background-size:36px_36px]"
      />

      {/* Chips de categoría: la misma altura que los reales. */}
      <div
        aria-hidden
        className="absolute left-0 right-0 top-gap-sm flex gap-gap-xs overflow-hidden px-gutter"
      >
        {[64, 92, 72, 104, 60].map((ancho, i) => (
          <div
            key={i}
            className="skeleton-shimmer h-9 shrink-0 rounded-full"
            style={{ width: ancho }}
          />
        ))}
      </div>

      <div
        className="absolute inset-x-0 bottom-0 rounded-t-4xl bg-white shadow-[0_-8px_40px_-12px_rgba(8,19,13,0.18)] [transform:translateY(calc(100%_-_min(430px,55vh)))]"
      >
        <div className="flex min-h-11 items-center justify-center pb-[6px] pt-[10px]">
          <div className="h-[4px] w-[36px] rounded-full bg-ink/10" />
        </div>
        <div className="flex items-start justify-between gap-gap-sm border-b border-ink/5 px-5 pb-gap-sm">
          <div>
            <h2 className="font-lv-display text-h3 font-semibold text-ink">
              Cerca de ti
            </h2>
            <p className="mt-[2px] text-[13px] leading-[18px] text-ink-soft/75">
              Lugares cerca de ti
            </p>
          </div>
          <span
            aria-hidden
            className="mt-1 size-5 shrink-0 animate-spin rounded-full border-2 border-verde-300 border-t-transparent"
          />
        </div>
        {/* Las tarjetas quedan por debajo del pliegue hasta que la hoja sube;
            están para que el alto de la hoja sea el suyo desde el principio. */}
        <div aria-hidden className="flex flex-col gap-[10px] px-gutter py-gap-sm">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex gap-[12px] rounded-2xl border border-ink/5 p-3"
            >
              <div className="skeleton-shimmer size-[52px] shrink-0 rounded-lv-lg" />
              <div className="flex flex-1 flex-col gap-2 pt-1">
                <div className="skeleton-shimmer h-[14px] w-[65%] rounded" />
                <div className="skeleton-shimmer h-[12px] w-[40%] rounded" />
                <div className="skeleton-shimmer h-[12px] w-[85%] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeShellSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}
