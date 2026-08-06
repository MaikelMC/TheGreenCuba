"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { Search, Mic, Sparkles, MessageCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearch } from "@/providers/search-provider";
import { UserMenu } from "./user-menu";

const SUGGESTIONS = [
  {
    query: "cafe tranquilo cerca de mi que acepte MLC",
    label: "Café tranquilo cerca de mi que acepte MLC",
    category: "Cafetería · Vedado",
    icon: "cafe",
  },
  {
    query: "restaurante con vista al mar para cenar",
    label: "Restaurante con vista al mar para cenar",
    category: "Restaurante · Malecón",
    icon: "restaurante",
  },
];

const RECENT_SEARCHES = [
  { query: "discotecas con reggaeton cubano", category: "Vida nocturna" },
  { query: "mercado de frutas frescas barato", category: "Mercado · Centro Habana" },
];

interface HeaderProps {
  onSearch?: (query: string) => void;
  isSearching?: boolean;
}

export function Header({ onSearch: propOnSearch, isSearching: propIsSearching }: HeaderProps) {
  let ctx: { onSearch: (q: string) => void; isSearching: boolean } | null = null;
  try {
    ctx = useSearch();
  } catch {}
  const effectiveOnSearch = propOnSearch ?? ctx?.onSearch;
  const effectiveIsSearching = propIsSearching ?? ctx?.isSearching;

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  return (
    <header className="fixed top-0 left-0 right-0 z-200 h-header border-b border-border bg-surface/95 backdrop-blur-[16px] flex items-center px-gap-md gap-gap-sm md:px-gap-lg min-h-[56px] md:min-h-[60px]">
      {/* Logo */}
      <Link href="/home" className="flex items-center gap-gap-xs shrink-0">
        <span className="size-[30px] bg-accent rounded-[8px] grid place-items-center text-white shrink-0">
          <MessageCircle size={14} strokeWidth={2.2} />
        </span>
        <span className="font-display text-[18px] font-bold tracking-[-0.02em] text-foreground max-sm:hidden">
          La Verde
        </span>
      </Link>

      {/* Search */}
      <div ref={searchRef} className="flex-1 relative max-md:flex-1 md:max-w-[480px] md:mx-auto">
        <form
          onSubmit={handleSubmit}
          className={cn(
            "flex items-center gap-gap-xs bg-white dark:bg-white/10 border border-border rounded-lv px-[14px] transition-all duration-normal cursor-text",
            focused && "border-accent shadow-[0_0_0_3px_var(--accent-soft)]",
            effectiveIsSearching && "border-accent",
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {effectiveIsSearching ? (
            <Loader2
              size={18}
              strokeWidth={1.8}
              className="text-accent shrink-0 animate-spin"
            />
          ) : (
            <Search
              size={18}
              strokeWidth={1.8}
              className="text-accent shrink-0"
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setFocused(true);
              setShowSuggestions(true);
            }}
            onBlur={() => setFocused(false)}
            placeholder="¿Qué buscas hoy..."
            className="flex-1 border-none bg-transparent outline-none text-[15px] text-foreground min-w-0 py-[10px] placeholder:text-muted-foreground"
            autoComplete="off"
          />
          <button
            type="button"
            className="size-9 rounded-full grid place-items-center text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all shrink-0"
            aria-label="Buscar por voz"
          >
            <Mic size={18} strokeWidth={1.8} />
          </button>
          <button
            type="submit"
            disabled={effectiveIsSearching}
            className="flex items-center gap-1 px-[14px] py-2 bg-accent text-white rounded-lv font-display text-[13px] font-semibold whitespace-nowrap shrink-0 hover:bg-accent-hover transition-colors max-sm:px-2 disabled:opacity-80"
          >
            {effectiveIsSearching ? (
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            ) : (
              <Sparkles size={14} strokeWidth={2} />
            )}
            <span className="max-sm:hidden">
              {effectiveIsSearching ? "Buscando…" : "Buscar con IA"}
            </span>
          </button>
          {effectiveIsSearching && (
            <div className="absolute inset-0 rounded-lv pointer-events-none shadow-[inset_0_0_0_1px_oklch(62%_0.16_145/0.5),0_0_16px_oklch(62%_0.16_145/0.15)]" />
          )}
        </form>

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-surface border border-border rounded-lv-lg shadow-lv-lg z-250 overflow-hidden">
            <div className="px-gap-md pt-[10px] pb-[4px] font-mono text-[10px] font-medium text-muted-foreground uppercase tracking-[0.08em]">
              Sugerencias
            </div>
            {SUGGESTIONS.map((s) => (
              <button
                key={s.query}
                type="button"
                className="flex items-center gap-gap-sm w-full px-gap-md py-[10px] text-left hover:bg-background transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSuggestionClick(s.query);
                }}
              >
                <span className="size-8 rounded-lv bg-accent/10 grid place-items-center text-accent shrink-0">
                  <Search size={16} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] text-foreground truncate">
                    {s.label}
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-px">
                    {s.category}
                  </div>
                </div>
              </button>
            ))}
            <div className="h-px bg-border mx-gap-md my-[4px]" />
            <div className="px-gap-md pb-[4px] font-mono text-[10px] font-medium text-muted-foreground uppercase tracking-[0.08em]">
              Búsquedas recientes
            </div>
            {RECENT_SEARCHES.map((s) => (
              <button
                key={s.query}
                type="button"
                className="flex items-center gap-gap-sm w-full px-gap-md py-[10px] text-left hover:bg-background transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSuggestionClick(s.query);
                }}
              >
                <span className="size-8 rounded-lv bg-amber/10 grid place-items-center text-amber shrink-0">
                  <Search size={16} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] text-foreground truncate">
                    {s.query}
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-px">
                    {s.category}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Avatar dropdown */}
      <UserMenu />
    </header>
  );
}
