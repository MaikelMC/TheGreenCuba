"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Navigation, Clock, Eye, Music } from "lucide-react";

const FILTERS = [
  { value: "distancia", label: "Cercanos", icon: Navigation },
  { value: "abierto", label: "Abiertos ahora", icon: Clock },
  { value: "tranquilo", label: "Tranquilo", icon: Eye },
  { value: "musica", label: "Con música", icon: Music },
];

interface PlaceFiltersProps {
  visible?: boolean;
  className?: string;
}

export function PlaceFilters({ visible, className }: PlaceFiltersProps) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(["distancia"]),
  );

  function toggle(value: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  if (!visible) return null;

  return (
    <div
      className={cn(
        "absolute top-[72px] left-0 right-0 z-20 overflow-x-auto scrollbar-hide flex gap-[6px] px-gutter",
        className,
      )}
    >
      {FILTERS.map((f) => {
        const Icon = f.icon;
        const isActive = activeFilters.has(f.value);
        return (
          <button
            key={f.value}
            type="button"
            onClick={() => toggle(f.value)}
            className={cn(
              "shrink-0 inline-flex items-center gap-[6px] px-3 py-1.5 rounded-full border font-lv-display text-meta font-medium whitespace-nowrap transition-all duration-500 ease-outquint",
              isActive
                ? "border-verde-400 bg-verde-400 text-verde-950 shadow-soft"
                : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
            )}
          >
            <Icon size={13} strokeWidth={1.8} />
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
