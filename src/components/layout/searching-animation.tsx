"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MapPin, Search } from "lucide-react";

const MESSAGES = [
  "Leyendo tu consulta…",
  "Analizando los lugares cerca de ti…",
  "Comparando monedas, horarios y ambiente…",
  "Ordenando los mejores matches…",
  "Casi listo…",
];

export function SearchingAnimation({ query }: { query?: string }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setIdx((i) => (i + 1) % MESSAGES.length),
      1900,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-5 text-center">
      {/* Radar */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative mb-6 flex size-24 items-center justify-center"
      >
        <span className="searching-ring" />
        <span className="searching-ring searching-ring--delay" />
        <div className="relative z-10 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-verde-400 to-verde-600 text-white shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)]">
          <MapPin size={26} strokeWidth={1.8} />
        </div>
        <span className="absolute -top-1 -right-1 z-20 flex size-7 items-center justify-center rounded-full bg-white text-verde-600 shadow-soft ring-1 ring-verde-200">
          <Search size={13} strokeWidth={1.8} />
        </span>
      </motion.div>

      {/* Status */}
      <div className="relative h-[24px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={idx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="font-lv-display text-body font-semibold tracking-[-0.02em] text-ink"
          >
            {MESSAGES[idx]}
          </motion.p>
        </AnimatePresence>
      </div>
      <p className="mt-1.5 max-w-[30ch] text-small text-ink-soft/75">
        {query ? `Busco el mejor plan para "${query}"` : "Buscando el mejor plan para ti"}
      </p>

      {/* Progress */}
      <div className="mt-5 h-[3px] w-44 overflow-hidden rounded-full bg-ink/10">
        <span className="searching-progress" />
      </div>
    </div>
  );
}
