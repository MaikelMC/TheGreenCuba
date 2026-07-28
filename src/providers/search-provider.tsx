"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

interface SearchContextValue {
  query: string;
  isSearching: boolean;
  setQuery: (q: string) => void;
  setIsSearching: (v: boolean) => void;
  onSearch: (q: string) => void;
  registerSearchHandler: (handler: (q: string) => void) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const handlerRef = useRef<((q: string) => void) | null>(null);

  const onSearch = useCallback(
    (q: string) => {
      setQuery(q);
      handlerRef.current?.(q);
    },
    [],
  );

  const registerSearchHandler = useCallback((h: (q: string) => void) => {
    handlerRef.current = h;
  }, []);

  return (
    <SearchContext.Provider
      value={{ query, isSearching, setQuery, setIsSearching, onSearch, registerSearchHandler }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within SearchProvider");
  return ctx;
}
