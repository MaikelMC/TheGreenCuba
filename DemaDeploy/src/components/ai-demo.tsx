"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Star
} from "lucide-react";
import { useRef, useState } from "react";
import Reveal from "@/components/ui/reveal";
import { PLACES, type Place } from "@/lib/places";
import { CATEGORY_META } from "@/lib/places";
import { cn } from "@/lib/utils";
import { easeSpring } from "@/lib/motion";

const EXAMPLES = [
  "Un lugar con vista al mar para cenar esta noche",
  "Café de especialidad para trabajar en La Habana",
  "Una playa cercana para el fin de semana"
];

// Intenta matchear la consulta contra los lugares (demo local)
function answerQuery(query: string): Place[] {
  const q = query.toLowerCase();
  const keywordMap: Record<string, string[]> = {
    mar: ["mar", "malecón", "playa", "vista", "pescado"],
    noche: ["noche", "cenar", "copas", "música", "bar"],
    café: ["café", "desayuno", "brunch", "trabajar"],
    trabajo: ["trabajar", "wifi", "café"],
    playa: ["playa", "sol", "natación"],
    naturaleza: ["naturaleza", "senderismo", "valle", "cueva", "picnic"],
    cultura: ["historia", "cultura", "arquitectura", "arte"]
  };
  const hits = new Set<Place>();
  const parts: string[] = [];

  for (const [key, words] of Object.entries(keywordMap)) {
    if (words.some((w) => q.includes(w))) parts.push(key);
  }

  const pool =
    parts.length > 0
      ? PLACES.filter((p) =>
          p.tags.some((t) => parts.some((pt) => t.includes(pt) || p.category === pt))
        )
      : PLACES.filter((p) => p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q));

  if (pool.length === 0) return PLACES.slice(0, 3);
  return pool.slice(0, 3);
}

export default function AiDemo() {
  const [query, setQuery] = useState("");
  const [thinking, setThinking] = useState(false);
  const [results, setResults] = useState<Place[] | null>(null);
  const [done, setDone] = useState(false);
  const reduce = useReducedMotion();
  const seq = useRef(0);

  const run = (q: string) => {
    if (!q.trim()) return;
    seq.current += 1;
    const id = seq.current;
    setQuery(q);
    setThinking(true);
    setResults(null);
    setDone(false);
    setTimeout(() => {
      if (seq.current !== id) return;
      setThinking(false);
      setResults(answerQuery(q));
      setDone(true);
    }, 1600);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") run(query);
  };

  const reset = () => {
    seq.current += 1;
    setQuery("");
    setThinking(false);
    setResults(null);
    setDone(false);
  };

  return (
    <section id="busqueda" className="relative overflow-hidden bg-verde-950 py-24 text-white sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(53,175,109,0.22),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(15,122,65,0.25),transparent_50%)]" />

      <div className="container relative z-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow border border-white/15 bg-white/5 text-verde-200 backdrop-blur-sm">
            <Sparkles className="h-3 w-3" strokeWidth={2} />
            Pregúntale a La Verde
          </span>
          <h2 className="mt-5 font-display text-balance text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
            Deja de buscar.{" "}
            <span className="bg-gradient-to-r from-verde-200 to-emerald-400 bg-clip-text text-transparent">
              Pregunta.
            </span>
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mx-auto mt-10 max-w-xl">
          <div className="shell">
            <div className="core p-1.5">
              <div className="flex items-center gap-2 rounded-[calc(2rem-10px)] bg-white/[0.06] px-4 py-1">
                <Sparkles className="h-5 w-5 shrink-0 text-verde-300" strokeWidth={1.8} />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setDone(false);
                  }}
                  onKeyDown={onKey}
                  placeholder="Ej. 'un lugar con vista al mar para cenar'"
                  className="w-full bg-transparent py-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
                />
                {done && !thinking ? (
                  <button
                    onClick={reset}
                    aria-label="Nueva búsqueda"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20"
                  >
                    <RefreshCw className="h-4 w-4" strokeWidth={2} />
                  </button>
                ) : (
                  <button
                    onClick={() => run(query)}
                    aria-label="Buscar"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-verde-400 text-verde-950 transition-all duration-300 hover:bg-verde-300 active:scale-[0.94]"
                  >
                    <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.2} className="mx-auto mt-4 flex max-w-xl flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => run(ex)}
              className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/70 transition-colors hover:border-verde-400/40 hover:text-white"
            >
              {ex}
            </button>
          ))}
        </Reveal>

        {/* Resultado */}
        <div className="mx-auto mt-10 min-h-[220px] max-w-2xl">
          <AnimatePresence mode="wait">
            {thinking && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 text-verde-200"
              >
                <RefreshCw
                  className={cn("h-4 w-4", reduce ? "" : "animate-spin")}
                  strokeWidth={2}
                />
                <span className="text-sm">
                  La Verde busca el lugar correcto cerca de ti…
                </span>
              </motion.div>
            )}

            {results && (
              <motion.div
                key="results"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: easeSpring }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 px-1 text-sm text-white/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-verde-400" />
                  {results.length} lugar{results.length !== 1 ? "es" : ""} recomendado
                  {results.length !== 1 ? "s" : ""} para ti
                </div>
                {results.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.1, duration: 0.5, ease: easeSpring }}
                    className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-verde-400/15 text-xl">
                      {CATEGORY_META[p.category].emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-display font-bold text-white">{p.name}</p>
                        <span className="flex items-center gap-1 text-xs font-semibold text-verde-300">
                          <Star className="h-3 w-3 fill-current" strokeWidth={2} />
                          {p.rating.toFixed(1)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-white/50">
                        {p.subcategory} · {p.city}
                      </p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-1 text-xs text-white/60 sm:flex">
                      <MapPin className="h-3.5 w-3.5 text-verde-300" strokeWidth={2} />
                      {p.priceLabel}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}