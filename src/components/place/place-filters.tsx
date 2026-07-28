"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Navigation, DollarSign, Clock, Eye, Music } from "lucide-react";

const FILTERS = [
  { value: "distancia", label: "Cercanos", icon: Navigation },
  { value: "mlc", label: "Aceptan MLC", icon: DollarSign },
  { value: "abierto", label: "Abiertos ahora", icon: Clock },
  { value: "tranquilo", label: "Tranquilo", icon: Eye },
  { value: "musica", label: "Con música", icon: Music },
];

interface PlaceFiltersProps {
  visible?: boolean;
  className?: string;
}

export function PlaceFilters({ visible, className }: PlaceFiltersProps) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(["distancia"]));

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
              "shrink-0 inline-flex items-center gap-[4px] px-[10px] py-[5px] rounded-full border font-mono text-[11px] font-medium whitespace-nowrap transition-all duration-fast",
              isActive
                ? "bg-accent/8 border-accent/30 text-accent"
                : "bg-surface border-border text-muted-foreground hover:border-accent hover:text-accent",
            )}
          >
            <Icon size={12} strokeWidth={2} />
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
