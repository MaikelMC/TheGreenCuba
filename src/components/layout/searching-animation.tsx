"use client";

import { useEffect, useState } from "react";
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
      <div className="relative mb-6 flex size-24 items-center justify-center">
        <span className="searching-ring" />
        <span className="searching-ring searching-ring--delay" />
        <div className="relative z-10 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-[0_6px_24px_oklch(62%_0.16_145_/_0.4)]">
          <MapPin size={26} strokeWidth={2} />
        </div>
        <span className="absolute -top-1 -right-1 z-20 flex size-7 items-center justify-center rounded-full bg-surface text-accent shadow-lv-sm ring-1 ring-accent/25">
          <Search size={13} strokeWidth={2.2} />
        </span>
      </div>

      {/* Status */}
      <p key={idx} className="searching-status font-display text-[16px] font-semibold tracking-[-0.02em] text-foreground">
        {MESSAGES[idx]}
      </p>
      <p className="mt-1.5 max-w-[30ch] text-[13px] text-muted-foreground">
        {query ? `Busco el mejor plan para "${query}"` : "Buscando el mejor plan para ti"}
      </p>

      {/* Progress */}
      <div className="mt-5 h-[3px] w-44 overflow-hidden rounded-full bg-surface">
        <span className="searching-progress" />
      </div>
    </div>
  );
}