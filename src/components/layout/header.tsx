"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Search, Mic, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchActions, useSearchState } from "@/providers/search-provider";
import { searchAddress, type GeocodeSuggestion } from "@/lib/map/geocode";
import { readRecentSearches, type RecentSearch } from "@/lib/recent-searches-store";
import { UserMenu } from "./user-menu";
import { Logo } from "./logo";

const SUGGESTIONS = [
  {
    query: "cafe tranquilo cerca de mi que acepte USD Clásica",
    label: "Café tranquilo cerca de mi que acepte USD Clásica",
    category: "Cafetería · Enramadas",
    icon: "cafe",
  },
  {
    query: "restaurante con vista al mar para cenar",
    label: "Restaurante con vista al mar para cenar",
    category: "Restaurante · Bahía",
    icon: "restaurante",
  },
];

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

/** Rótulo de sección del desplegable: el eyebrow del design system. */
const EYEBROW =
  "px-gap-md pb-[4px] font-lv-display text-[10px] font-semibold text-verde-600 uppercase tracking-[0.22em]";

/** Fila del desplegable (dirección, sugerencia o búsqueda reciente). */
const ROW =
  "flex items-center gap-gap-sm w-full px-gap-md py-[10px] text-left hover:bg-sand transition-colors duration-500";

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

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addrResults, setAddrResults] = useState<GeocodeSuggestion[]>([]);
  /* Arranca vacío y se llena al enfocar: leer `localStorage` durante el render
     haría que el HTML del servidor y el del navegador no coincidieran. */
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const addrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addrSeq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

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
      return;
    }
    const seq = ++addrSeq.current;
    addrTimer.current = setTimeout(async () => {
      try {
        const results = await searchAddress(raw);
        if (seq !== addrSeq.current) return;
        setAddrResults(results);
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
    <header className="fixed top-0 left-0 right-0 z-200 h-header border-b border-ink/5 bg-sand-warm/90 backdrop-blur-[16px] flex items-center px-3 gap-2 sm:px-gap-md sm:gap-gap-sm md:px-gap-lg min-h-[56px] md:min-h-[60px] font-lv text-ink">
      {/* Logo. El PNG ya trae su propio degradado verde, así que va suelto: el
          círculo `verde-400 → verde-600` que lo envolvía era del mismo tono y
          se lo comía. */}
      <Link href="/home" className="flex items-center gap-gap-xs shrink-0">
        <Logo className="h-[26px] w-auto shrink-0" />
        <span className="font-lv-display text-[19px] font-bold tracking-[-0.02em] text-ink max-sm:hidden">
          La Verde
        </span>
      </Link>

      {/* Search */}
      <div ref={searchRef} className="flex-1 relative max-md:flex-1 md:max-w-[480px] md:mx-auto">
        <form
          onSubmit={handleSubmit}
          className={cn(
            "flex items-center gap-2 sm:gap-gap-xs bg-white border border-ink/10 rounded-full pl-3 pr-3 sm:pl-[14px] sm:pr-2 transition-all duration-500 ease-outquint cursor-text",
            focused && "border-verde-400 shadow-[0_0_0_3px_rgba(53,175,109,0.15)]",
            effectiveIsSearching && "border-verde-400",
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {effectiveIsSearching ? (
            <Loader2
              size={18}
              strokeWidth={1.8}
              className="text-verde-600 shrink-0 animate-spin"
            />
          ) : (
            <Search
              size={18}
              strokeWidth={1.8}
              className="text-verde-600 shrink-0"
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
              /* Se relee en cada apertura: el historial lo escribe el home al
                 buscar, y este header sigue montado mientras eso pasa. */
              setRecent(readRecentSearches());
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
          {/* El micrófono no tiene `onClick`: es un botón muerto de 44 px que en
              móvil se comía el ancho del campo. Ahí se oculta. */}
          <button
            type="button"
            className="size-11 shrink-0 rounded-full grid place-items-center text-ink-soft/75 transition-colors duration-500 hover:bg-verde-50 hover:text-verde-600 max-sm:hidden"
            aria-label="Buscar por voz"
          >
            <Mic size={18} strokeWidth={1.8} />
          </button>
          {/* Sin botón de enviar: el formulario ya se confirma con Enter desde
              el propio campo, y el botón se comía el ancho útil en móvil. */}
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
                  {addrResults.map((s, i) => {
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
                  <div className="h-px bg-ink/5 mx-gap-md my-[4px]" />
                </>
              )}
              <div className={cn(EYEBROW, "pt-[10px]")}>
                Sugerencias
              </div>
              {SUGGESTIONS.map((s, i) => (
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
                  <span className="size-8 rounded-xl bg-verde-50 grid place-items-center text-verde-700 shrink-0">
                    <Search size={16} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-small text-ink truncate">
                      {s.label}
                    </div>
                    <div className="text-meta text-ink-soft/75 mt-px">
                      {s.category}
                    </div>
                  </div>
                </motion.button>
              ))}
              {/* Sin historial no hay sección: en un navegador recién estrenado
                  el rótulo se quedaba anunciando una lista vacía. */}
              {recent.length > 0 && (
                <>
                  <div className="h-px bg-ink/5 mx-gap-md my-[4px]" />
                  <div className={EYEBROW}>
                    Búsquedas recientes
                  </div>
                  {recent.map((s, i) => (
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
