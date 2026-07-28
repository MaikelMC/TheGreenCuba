"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  Coffee,
  UtensilsCrossed,
  Wine,
  Music,
  ShoppingBag,
  Umbrella,
  Landmark,
  Dumbbell,
  Bed,
  Car,
} from "lucide-react";

const CATEGORIES = [
  { value: "all", label: "Todo", icon: LayoutGrid },
  { value: "cafeteria", label: "Cafeterías", icon: Coffee },
  { value: "restaurante", label: "Restaurantes", icon: UtensilsCrossed },
  { value: "bar", label: "Bares", icon: Wine },
  { value: "discoteca", label: "Vida nocturna", icon: Music },
  { value: "mercado", label: "Mercados", icon: ShoppingBag },
  { value: "playa", label: "Playas", icon: Umbrella },
  { value: "cultura", label: "Cultura", icon: Landmark },
  { value: "deporte", label: "Deporte", icon: Dumbbell },
  { value: "hospedaje", label: "Hospedaje", icon: Bed },
  { value: "transporte", label: "Transporte", icon: Car },
];

interface CategoryBarProps {
  active?: string;
  onSelect?: (value: string) => void;
}

export function CategoryBar({ active = "all", onSelect }: CategoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="absolute top-gap-sm left-0 right-0 z-20 overflow-x-auto scrollbar-hide flex gap-gap-xs px-gutter"
    >
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = active === cat.value;
        return (
          <button
            key={cat.value}
            type="button"
            onClick={() => onSelect?.(cat.value)}
            className={cn(
              "shrink-0 inline-flex items-center gap-[6px] px-[14px] py-2 rounded-full border font-display text-[13px] font-medium whitespace-nowrap transition-all duration-normal shadow-lv-xs",
              isActive
                ? "bg-accent border-accent text-white shadow-[0_2px_8px_oklch(62%_0.16_145_/_0.3)]"
                : "bg-surface border-border text-muted-foreground hover:border-accent hover:text-accent",
            )}
          >
            <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
