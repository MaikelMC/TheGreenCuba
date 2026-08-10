"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MapPin, Navigation, Users } from "lucide-react";
import { motion } from "framer-motion";
import Reveal from "@/components/ui/reveal";
import Counter from "@/components/ui/counter";
import { PLACES, type Place } from "@/lib/places";
import { CATEGORY_META } from "@/lib/places";
import { cn } from "@/lib/utils";

// Mapa Leaflet cargado solo en cliente, aislado del bundle principal
const LeafMap = dynamic(() => import("@/components/leaf-map"), {
  ssr: false,
  loading: () => <MapSkeleton />
});

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-verde-950/40">
      <div className="flex flex-col items-center gap-3 text-white/50">
        <div className="h-10 w-10 animate-pulse rounded-full bg-verde-400/30" />
        <p className="text-xs uppercase tracking-[0.2em]">Cargando el mapa verde…</p>
      </div>
    </div>
  );
}

export default function MapDemo() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? PLACES : PLACES.slice(0, 4);
  const selected = PLACES.find((p) => p.id === selectedId);

  const pick = (p: Place) => {
    setSelectedId(p.id);
  };

  return (
    <section id="mapa" className="relative bg-sand py-24 sm:py-32">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow border border-verde-200 bg-verde-50 text-verde-600">
            El mapa que te da la verde
          </span>
          <h2 className="mt-5 font-display text-balance text-4xl font-bold tracking-[-0.02em] text-ink sm:text-5xl">
            Cuba, sin ruido.{" "}
            <span className="text-verde-600">Solo lo bueno.</span>
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-ink-soft/80 sm:text-lg">
            Cada lugar está geolocalizado y señalado por gente local. Te decimos qué
            hay cerca de ti y si vale la pena. Las opiniones no se compran: se
            merecen.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          <div className="shell-light">
            <div className="core">
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
                {/* Mapa */}
                <div className="relative h-[460px] sm:h-[540px] lg:h-auto lg:min-h-[560px]">
                  <div className="absolute inset-0">
                    <LeafMap
                      places={PLACES}
                      selectedId={selectedId}
                      onSelect={pick}
                    />
                  </div>
                </div>

                {/* Panel lateral */}
                <div className="flex flex-col border-t border-ink/5 bg-sand-warm lg:border-l lg:border-t-0">
                  <div className="px-6 pb-3 pt-6">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-verde-100 text-verde-700">
                        <MapPin className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <div>
                        <p className="font-display text-base font-bold text-ink">
                          Lugares recomendados
                        </p>
                        <p className="text-xs text-ink-soft/60">
                          toca uno para verlo en el mapa
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto px-6 pb-4 lg:max-h-[420px]">
                    {visible.map((p, i) => {
                      const active = p.id === selectedId;
                      return (
                        <button
                          key={p.id}
                          onClick={() => pick(p)}
                          className={cn(
                            "group w-full rounded-2xl border p-3.5 text-left transition-all duration-300",
                            active
                              ? "border-verde-500/40 bg-verde-50 shadow-soft"
                              : "border-transparent bg-white/70 hover:bg-white"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-verde-700">
                              {CATEGORY_META[p.category].emoji} {CATEGORY_META[p.category].label}
                            </span>
                            <span className="text-[11px] font-medium text-ink-soft/50">
                              {p.priceLabel}
                            </span>
                          </div>
                          <p className="mt-1 font-display text-base font-bold text-ink">
                            {p.name}
                          </p>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-xs text-ink-soft/70">
                              {p.city} · {p.province}
                            </span>
                            <span className="flex items-center gap-1 text-xs font-semibold text-verde-600">
                              <Navigation className="h-3 w-3" strokeWidth={2.2} />
                              {p.rating.toFixed(1)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {!showAll && (
                      <button
                        onClick={() => setShowAll(true)}
                        className="mt-1 w-full rounded-2xl border border-dashed border-verde-400/40 bg-verde-50/50 py-3 text-xs font-semibold text-verde-700 transition-colors hover:bg-verde-50"
                      >
                        Ver todos los lugares →
                      </button>
                    )}
                  </div>

                  <div className="border-t border-ink/5 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-ink-soft/60">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute h-full w-full animate-ping rounded-full bg-verde-400 opacity-70" />
                          <span className="relative h-2 w-2 rounded-full bg-verde-500" />
                        </span>
                        Te pasamos la verde cada semana
                      </div>
                      <div className="flex items-center gap-1 text-xs text-ink-soft/60">
                        <Users className="h-3.5 w-3.5" strokeWidth={2} />
                        <Counter to={67} format={(n) => `${n}`} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Tarjeta de estado (overlay sobre el mapa, sutil) */}
        <Reveal delay={0.2} className="mt-6 text-center">
          <p className="text-xs text-ink-soft/50">
            * Vista previa con datos de muestra. La versión uno llegará con cientos de lugares recomendados.
          </p>
        </Reveal>
      </div>
      {selected && (
        <div className="sr-only" aria-live="polite">
          Seleccionado: {selected.name}
        </div>
      )}
    </section>
  );
}