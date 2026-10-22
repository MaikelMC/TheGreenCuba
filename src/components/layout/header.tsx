"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, Loader2, MapPin, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchActions, useSearchState } from "@/providers/search-provider";
import { searchAddress, type GeocodeSuggestion } from "@/lib/map/geocode";
import { readRecentSearches, type RecentSearch } from "@/lib/recent-searches-store";
import { getLastKnownPosition } from "@/lib/map/geolocation";
import { locationCenter, readUserPreferences } from "@/lib/user-preferences-store";
import { buildSearchSuggestions, type SearchSuggestion } from "@/lib/search-suggestions";
import { categoryIcon } from "@/lib/places";
import { fetchMe } from "@/lib/session-client";
import { CategoryIcon } from "@/components/admin/category-icon";
import { usePlaces } from "@/providers/places-provider";
import { UserMenu } from "./user-menu";
import { Logo } from "./logo";

/**
 * Desde dónde se mide la cercanía de las sugerencias: la posición real si ya hay
 * un fix guardado y, si no —quien completó el onboarding no da permiso hasta que
 * toca el botón del mapa—, el centro de la ciudad que eligió. Cuál de las dos es
 * viaja también, porque con el centro de la ciudad la fila no puede decir «a
 * 320 m de ti».
 */
function suggestionOrigin(userId?: string | null) {
  /* Las preferencias del onboarding viajan con el origen: son lo que decide
     qué categorías salen primero en el desplegable. La lectura sin id las
     encuentra igual —el almacén recuerda de quién son— así que esto vale
     tanto para quien tiene sesión como para quien completó el onboarding sin
     cuenta. */
  const preferences = readUserPreferences(userId ?? null);
  const cached = getLastKnownPosition();
  if (cached) {
    return {
      origin: { lat: cached.lat, lng: cached.lng },
      originIsUserPosition: true,
      cityLabel: preferences.locationName,
      preferences,
    };
  }
  const [lat, lng] = locationCenter(preferences.location);
  return {
    origin: { lat, lng },
    originIsUserPosition: false,
    cityLabel: preferences.locationName,
    preferences,
  };
}

/** Distancia en palabras hasta una búsqueda. La lista solo se pinta ya en el
    cliente —se lee al enfocar el campo—, así que no hay riesgo de que el HTML
    del servidor y el del navegador digan cosas distintas. */
function timeAgo(at: number): string {
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
}

/** Búsquedas recientes visibles sin desplegar el resto. */
const RECENT_PREVIEW = 2;

/** Direcciones visibles sin desplegar el resto. */
const ADDR_PREVIEW = 3;

/** Rótulo de sección del desplegable: el eyebrow del design system. */
const EYEBROW =
  "px-gap-md pb-[4px] font-lv-display text-[10px] font-semibold text-verde-600 uppercase tracking-[0.22em]";

/** Fila del desplegable (dirección, sugerencia o búsqueda reciente). */
const ROW =
  "flex items-center gap-gap-sm w-full px-gap-md py-[10px] text-left hover:bg-sand transition-colors duration-500";

/**
 * «Ver más» / «Ver menos» de una lista del desplegable. El `mousedown` se
 * cancela para que el campo no pierda el foco y el desplegable no se cierre al
 * desplegar la lista.
 */
function ShowMoreButton({
  expanded,
  remaining,
  onToggle,
}: {
  expanded: boolean;
  remaining: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      className="flex items-center justify-center gap-[6px] w-full px-gap-md pt-[6px] pb-[10px] text-meta font-medium text-ink-soft/70 transition-colors duration-500 hover:text-verde-700"
      onMouseDown={(e) => {
        e.preventDefault();
        onToggle();
      }}
    >
      {expanded ? "Ver menos" : `Ver ${remaining} más`}
      <ChevronDown
        size={14}
        strokeWidth={1.8}
        className={cn(
          "transition-transform duration-300",
          expanded && "rotate-180",
        )}
      />
    </button>
  );
}

interface HeaderProps {
  onSearch?: (query: string) => void;
  isSearching?: boolean;
}

export function Header({ onSearch: propOnSearch, isSearching: propIsSearching }: HeaderProps) {
  let actions: ReturnType<typeof useSearchActions> | null = null;
  try {
    actions = useSearchActions();
  } catch {}
  let state: ReturnType<typeof useSearchState> | null = null;
  try {
    state = useSearchState();
  } catch {}
  const effectiveOnSearch = propOnSearch ?? actions?.onSearch;
  const effectiveIsSearching = propIsSearching ?? state?.isSearching;
  const effectiveLocate = actions?.onLocateAddress;
  const { places, categories } = usePlaces();

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addrResults, setAddrResults] = useState<GeocodeSuggestion[]>([]);
  /* Arranca vacío y se llena al enfocar: leer `localStorage` durante el render
     haría que el HTML del servidor y el del navegador no coincidieran. */
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  /* El historial enseña solo las dos últimas; el resto queda detrás de «Ver
     más». Se recoge otra vez cada vez que se abre el desplegable. */
  const [showAllRecent, setShowAllRecent] = useState(false);
  /* Mismo criterio para las direcciones: las tres primeras y el resto detrás
     de «Ver más». Se recoge cada vez que llega una búsqueda nueva. */
  const [showAllAddr, setShowAllAddr] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addrSeq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    /* Dos intentos, como en el menú de usuario: la ruta contesta
       `authenticated: false` tanto si no hay sesión como si se le cayó el viaje
       a Neon, y de este id salen las búsquedas recientes de quien entra —sin
       él se leen del cajón de invitado, que para alguien con sesión está
       vacío—. */
    async function load(attempt: number): Promise<void> {
      const data = await fetchMe<{
        authenticated?: boolean;
        user?: { id?: string } | null;
      }>({ force: attempt > 0 }).catch(() => null);

      if (!alive) return;

      if (data?.authenticated && data.user?.id) {
        setUserId(data.user.id);
        return;
      }

      if (attempt === 0) {
        timer = setTimeout(() => void load(1), 1500);
      }
    }

    void load(0);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (addrTimer.current) clearTimeout(addrTimer.current);
      addrSeq.current++;
    };
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      effectiveOnSearch?.(query.trim());
      setShowSuggestions(false);
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setQuery(suggestion);
    setShowSuggestions(false);
    effectiveOnSearch?.(suggestion);
  }

  // Búsqueda de direcciones con Photon dentro del mismo campo.
  function handleQueryChange(raw: string) {
    setQuery(raw);
    if (addrTimer.current) clearTimeout(addrTimer.current);
    if (raw.trim().length < 3) {
      setAddrResults([]);
      setShowAllAddr(false);
      return;
    }
    const seq = ++addrSeq.current;
    addrTimer.current = setTimeout(async () => {
      try {
        const results = await searchAddress(raw);
        if (seq !== addrSeq.current) return;
        setAddrResults(results);
        setShowAllAddr(false);
      } catch {
        if (seq !== addrSeq.current) return;
        setAddrResults([]);
      }
    }, 350);
  }

  function handleAddressPick(s: GeocodeSuggestion) {
    if (addrTimer.current) clearTimeout(addrTimer.current);
    setShowSuggestions(false);
    const label =
      [s.street, s.housenumber].filter(Boolean).join(" ") +
      (s.between ? ` e/ ${s.between}` : "");
    setQuery(label);
    if (effectiveLocate) {
      effectiveLocate({ lat: s.lat, lng: s.lng, label });
    } else {
      handleSuggestionClick(label);
    }
  }

  return (
    // En móvil el aire se recorta a 12/8 px: con los 16/12 de escritorio el
    // campo de búsqueda se quedaba en ~88 px y el marcador no cabía.
    <header className="map-navigation fixed top-0 left-0 right-0 z-200 h-header border-b border-ink/5 bg-sand-warm/90 backdrop-blur-[16px] flex items-center px-3 gap-2 sm:px-gap-md sm:gap-gap-sm md:px-gap-lg min-h-[56px] md:min-h-[60px] font-lv text-ink">
      {/* Logo. El PNG ya trae su propio degradado verde, así que va suelto: el
          círculo `verde-400 → verde-600` que lo envolvía era del mismo tono y
          se lo comía.

          Es un `<a>` y no un `<Link>` **a propósito**: el icono recarga el
          sitio. Con `Link` la navegación es por cliente, y estando ya en
          `/home` —que es donde se está casi siempre— pulsarlo no hacía
          absolutamente nada. Un ancla normal la trata el navegador como una
          carga nueva, y ahí sí vuelve todo a pedirse: la sesión, `/api/me` y
          el catálogo. Es el gesto de «esto se ha quedado tonto, que se
          recargue». */}
      <a href="/home" className="flex items-center gap-gap-xs shrink-0">
        <Logo className="h-[26px] w-auto shrink-0" />
        <span className="font-lv-display text-[19px] font-bold tracking-[-0.02em] text-ink max-sm:hidden">
          <span translate="no">La Verde</span>
        </span>
      </a>

      {/* Search */}
      <div ref={searchRef} className="flex-1 relative max-md:flex-1 md:max-w-[480px] md:mx-auto">
        <form
          onSubmit={handleSubmit}
          className={cn(
            "home-search-form flex items-center gap-2 sm:gap-gap-xs bg-white border border-ink/10 rounded-full pl-3 pr-3 sm:pl-[14px] sm:pr-2 transition duration-500 ease-outquint cursor-text",
            focused && "border-verde-400 shadow-[0_0_0_3px_rgba(53,175,109,0.15)]",
            effectiveIsSearching && "border-verde-400",
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {effectiveIsSearching && (
            <Loader2
              size={18}
              strokeWidth={1.8}
              className="text-verde-600 shrink-0 animate-spin"
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => {
              setFocused(true);
              setShowSuggestions(true);
              /* El desplegable sale por debajo de la hoja de recomendaciones
                 —su z es mayor—, así que al abrirse las sugerencias la hoja se
                 recoge. Sin esto, en el móvil media lista se quedaba tapada. */
              actions?.onSuggestionsOpen();
              /* Se relee en cada apertura: el historial lo escribe el home al
                 buscar, y este header sigue montado mientras eso pasa. */
              setRecent(readRecentSearches());
              setShowAllRecent(false);
              setShowAllAddr(false);
              setSuggestions(buildSearchSuggestions({ places, ...suggestionOrigin(userId) }));
              if (query.trim().length >= 3) handleQueryChange(query);
              else setAddrResults([]);
            }}
            onBlur={() => setFocused(false)}
            // El placeholder es la única etiqueta visible, así que el campo
            // lleva nombre accesible propio: sin él, un lector de pantalla solo
            // anuncia "cuadro de edición".
            aria-label="Buscar lugares con IA"
            placeholder="¿Qué buscas? La IA te entiende"
            className="flex-1 border-none bg-transparent outline-none text-[15px] text-ink min-w-0 py-[11px] placeholder:text-ink-soft/75"
            autoComplete="off"
          />
          {/* Confirmar sin depender de Enter: en móvil el teclado muchas veces
              oculta o no tiene la tecla de envío. */}
          <button
            type="submit"
            aria-label="Buscar"
            disabled={!query.trim() || effectiveIsSearching}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-verde-600 text-white transition hover:bg-verde-700 active:scale-95 disabled:bg-ink/10 disabled:text-ink-soft/50 disabled:hover:bg-ink/10"
          >
            <Search size={15} strokeWidth={2.4} aria-hidden />
          </button>
          {effectiveIsSearching && (
            <div className="absolute inset-0 rounded-full pointer-events-none shadow-[inset_0_0_0_1px_rgba(53,175,109,0.5),0_0_16px_rgba(53,175,109,0.15)]" />
          )}
        </form>

        {/* Suggestions dropdown */}
        <AnimatePresence>
          {showSuggestions && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              // En móvil el campo se estrecha y el desplegable heredaba ese
              // ancho (~158 px): los rótulos no caben. Ahí se despega del campo
              // y se ancla a la barra, de borde a borde.
              className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white border border-ink/5 rounded-2xl shadow-card z-250 overflow-hidden max-sm:fixed max-sm:top-[calc(var(--header-h)+6px)] max-sm:left-3 max-sm:right-3"
            >
              {addrResults.length > 0 && (
                <>
                  <div className={cn(EYEBROW, "pt-[10px]")}>
                    Direcciones
                  </div>
                  {(showAllAddr
                    ? addrResults
                    : addrResults.slice(0, ADDR_PREVIEW)
                  ).map((s, i) => {
                    const main = [s.street, s.housenumber]
                      .filter(Boolean)
                      .join(" ");
                    const area =
                      [s.district, s.city].filter(Boolean).join(" · ") ||
                      "Cuba";
                    return (
                      <motion.button
                        key={`addr-${s.lat}-${s.lng}-${i}`}
                        type="button"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.04 + i * 0.04,
                          duration: 0.3,
                        }}
                        className={ROW}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAddressPick(s);
                        }}
                      >
                        <span className="size-8 rounded-xl bg-verde-50 grid place-items-center text-verde-700 shrink-0">
                          <MapPin size={16} strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-small text-ink truncate">
                            {main}
                            {s.between && (
                              <span className="text-ink-soft/75">
                                {" "}
                                e/ {s.between}
                              </span>
                            )}
                          </div>
                          <div className="text-meta text-ink-soft/75 mt-px truncate">
                            {area}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                  {addrResults.length > ADDR_PREVIEW && (
                    <ShowMoreButton
                      expanded={showAllAddr}
                      remaining={addrResults.length - ADDR_PREVIEW}
                      onToggle={() => setShowAllAddr((v) => !v)}
                    />
                  )}
                  <div className="h-px bg-ink/5 mx-gap-md my-[4px]" />
                </>
              )}
              {/* Sin catálogo cerca no hay sección: antes el rótulo anunciaba
                  dos sugerencias escritas a mano aunque no hubiera cargado
                  nada. El separador de abajo lo pone el bloque siguiente. */}
              {suggestions.length > 0 && (
                <>
                  <div className={cn(EYEBROW, "pt-[10px]")}>
                    Sugerencias
                  </div>
                  {suggestions.map((s, i) => (
                    <motion.button
                      key={s.query}
                      type="button"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 + i * 0.04, duration: 0.3 }}
                      className={ROW}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSuggestionClick(s.query);
                      }}
                    >
                      {/* El icono es el de la categoría en el catálogo: el mismo
                          que llevan su pin y su tarjeta. */}
                      <span className="size-8 rounded-xl bg-verde-50 grid place-items-center text-verde-700 shrink-0">
                        <CategoryIcon
                          icon={categoryIcon(s.category, categories)}
                          size={16}
                          strokeWidth={1.8}
                        />
                      </span>
                      <div className="min-w-0">
                        <div className="text-small text-ink truncate">
                          {s.label}
                        </div>
                        <div className="text-meta text-ink-soft/75 mt-px">
                          {s.detail}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </>
              )}
              {/* Sin historial no hay sección: en un navegador recién estrenado
                  el rótulo se quedaba anunciando una lista vacía. */}
              {recent.length > 0 && (
                <>
                  <div className="h-px bg-ink/5 mx-gap-md my-[4px]" />
                  <div className={EYEBROW}>
                    Búsquedas recientes
                  </div>
                  {(showAllRecent
                    ? recent
                    : recent.slice(0, RECENT_PREVIEW)
                  ).map((s, i) => (
                    <motion.button
                      key={s.query}
                      type="button"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.14 + i * 0.04, duration: 0.3 }}
                      className={ROW}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSuggestionClick(s.query);
                      }}
                    >
                      <span className="size-8 rounded-xl bg-sand-deep grid place-items-center text-ink-soft/75 shrink-0">
                        <Search size={16} strokeWidth={1.8} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-small text-ink truncate">
                          {s.query}
                        </div>
                        <div className="text-meta text-ink-soft/75 mt-px">
                          {timeAgo(s.at)}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                  {recent.length > RECENT_PREVIEW && (
                    <ShowMoreButton
                      expanded={showAllRecent}
                      remaining={recent.length - RECENT_PREVIEW}
                      onToggle={() => setShowAllRecent((v) => !v)}
                    />
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Avatar dropdown */}
      <UserMenu />
    </header>
  );
}
