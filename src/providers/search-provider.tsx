"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

interface SearchState {
  query: string;
  isSearching: boolean;
}

interface SearchActions {
  setQuery: (q: string) => void;
  setIsSearching: (v: boolean) => void;
  onSearch: (q: string) => void;
  registerSearchHandler: (handler: (q: string) => void) => void;
}

const SearchStateContext = createContext<SearchState | null>(null);
const SearchActionsContext = createContext<SearchActions | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const handlerRef = useRef<((q: string) => void) | null>(null);

  const onSearch = useCallback((q: string) => {
    setQuery(q);
    handlerRef.current?.(q);
  }, []);

  const registerSearchHandler = useCallback((h: (q: string) => void) => {
    handlerRef.current = h;
  }, []);

  // Acciones estables: los consumidores que solo llaman a la IA
  // (home) o leen isSearching (header) NO se re-renderizan cuando
  // cambia `query`.
  const actions = useMemo<SearchActions>(
    () => ({ setQuery, setIsSearching, onSearch, registerSearchHandler }),
    [onSearch, registerSearchHandler],
  );

  const state = useMemo<SearchState>(() => ({ query, isSearching }), [query, isSearching]);

  return (
    <SearchActionsContext.Provider value={actions}>
      <SearchStateContext.Provider value={state}>
        {children}
      </SearchStateContext.Provider>
    </SearchActionsContext.Provider>
  );
}

export function useSearchActions(): SearchActions {
  const ctx = useContext(SearchActionsContext);
  if (!ctx) throw new Error("useSearchActions debe usarse dentro de <SearchProvider>");
  return ctx;
}

export function useSearchState(): SearchState {
  const ctx = useContext(SearchStateContext);
  if (!ctx) throw new Error("useSearchState debe usarse dentro de <SearchProvider>");
  return ctx;
}

// Compat: combinación de ambos. Prefiere useSearchActions/useSearchState.
export function useSearch() {
  const actions = useContext(SearchActionsContext);
  const state = useContext(SearchStateContext);
  if (!actions || !state) throw new Error("useSearch debe usarse dentro de <SearchProvider>");
  return { ...actions, ...state };
}
