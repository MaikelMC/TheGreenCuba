"use client";

import { useState, useCallback } from "react";
import type { SearchResult, SearchQuery } from "@/types";

interface SearchState {
  query: string;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  reasoning: string | null;
}

export function useSearch() {
  const [state, setState] = useState<SearchState>({
    query: "",
    results: [],
    loading: false,
    error: null,
    reasoning: null,
  });

  const search = useCallback(async (params: SearchQuery) => {
    setState((prev) => ({ ...prev, query: params.query, loading: true, error: null }));

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) throw new Error("Error en la búsqueda");

      const data = (await res.json()) as {
        results: SearchResult[];
        reasoning: string;
      };

      setState({
        query: params.query,
        results: data.results,
        reasoning: data.reasoning,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Error de conexión",
      }));
    }
  }, []);

  const clear = useCallback(() => {
    setState({ query: "", results: [], loading: false, error: null, reasoning: null });
  }, []);

  return { ...state, search, clear };
}
