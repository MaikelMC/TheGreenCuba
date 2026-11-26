"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Search, Sparkles } from "lucide-react";

const EJEMPLOS = [
  "pizza a domicilio que acepte CUP",
  "dónde desayunar ahora",
  "tienda con productos de aseo",
  "barbería abierta hoy",
] as const;

/**
 * La pantalla de búsqueda del home.
 *
 * Es una capa de interfaz, no un cambio en la búsqueda: al enviar llama al
 * mismo `handleSearch` que ya habla con `/api/ai/search`. Los ejemplos enseñan
 * la frase que la IA entiende; no son datos ni resultados.
 */
export function HomeSearchOverlay({
  open,
  onClose,
  onSearch,
}: {
  open: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") onClose();
    }
    window.addEventListener("keydown", alTeclear);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", alTeclear);
    };
  }, [open, onClose]);

  function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio) {
      inputRef.current?.focus();
      return;
    }
    onSearch(limpio);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Buscar con IA"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[400] flex flex-col bg-sand-warm font-lv text-ink"
        >
          <div className="safe-top flex h-header items-center gap-1 border-b border-ink/5 px-1 sm:gap-2 sm:px-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Volver"
              className="grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors duration-300 hover:bg-sand-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
            >
              <ArrowLeft size={20} strokeWidth={2} aria-hidden />
            </button>

            <label htmlFor="home-ia-query" className="sr-only">
              Qué buscas
            </label>
            <input
              ref={inputRef}
              id="home-ia-query"
              type="search"
              value={query}
              onChange={(evento) => setQuery(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === "Enter") enviar(query);
              }}
              placeholder="Pizza a domicilio que acepte CUP…"
              autoComplete="off"
              enterKeyHint="search"
              className="h-11 min-w-0 flex-1 rounded-full border border-ink/10 bg-white px-4 font-lv text-body text-ink outline-none transition-colors duration-300 placeholder:text-ink-soft/60 focus:border-verde-400 focus:ring-2 focus:ring-verde-400/30"
            />

            <button
              type="button"
              onClick={() => enviar(query)}
              disabled={!query.trim()}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-[6px] rounded-full bg-verde-400 px-4 font-lv-display text-small font-semibold text-verde-950 transition-colors duration-500 hover:bg-verde-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink-soft/50"
            >
              <Search size={15} strokeWidth={2.2} aria-hidden />
              Buscar
            </button>
          </div>

          <div className="flex flex-col gap-gap-sm px-4 py-5">
            <p className="text-small leading-relaxed text-ink-soft/75">
              Escribe como hablas. Por ejemplo:
            </p>
            <div className="flex flex-col gap-gap-xs">
              {EJEMPLOS.map((ejemplo) => (
                <button
                  key={ejemplo}
                  type="button"
                  onClick={() => enviar(ejemplo)}
                  className="flex min-h-12 items-center gap-gap-sm rounded-2xl border border-ink/10 bg-white px-4 py-3 text-left font-lv text-body text-ink transition-colors duration-300 ease-outquint hover:border-verde-300 hover:bg-verde-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
                >
                  <Sparkles
                    size={18}
                    strokeWidth={1.8}
                    aria-hidden
                    className="shrink-0 text-verde-600"
                  />
                  {ejemplo}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
