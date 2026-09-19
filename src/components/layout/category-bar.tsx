"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/admin/category-icon";
import type { BusinessCategory } from "@/lib/places";

/**
 * Los chips de categoría del mapa.
 *
 * La lista la sirve quien la usa —el catálogo que viene de la base— y no una
 * copia dentro del componente. Antes estaba escrita aquí a mano y se había
 * separado del catálogo real: tenía «Deporte» y «Transporte», que ya no
 * existen como categoría, y le faltaban «Tienda», «Servicio», «Naturaleza» y
 * «Otro». Con la lista de fuera, además, el icono del chip es el que el admin
 * edita en `/admin/categorias`, así que coincide con el del pin.
 *
 * Los rótulos van en singular porque son los nombres de la base. Los plurales
 * que había antes («Cafeterías», «Restaurantes») eran otra tabla de
 * equivalencias que mantener.
 */
interface CategoryBarProps {
  categories: BusinessCategory[];
  active?: string;
  onSelect?: (value: string) => void;
}

export function CategoryBar({ categories, active = "all", onSelect }: CategoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const chips = [
    { value: "all", label: "Todo", icon: null as string | null },
    ...categories.map((c) => ({ value: c.value, label: c.label, icon: c.icon ?? null })),
  ];

  return (
    <motion.div
      ref={scrollRef}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-gap-sm left-0 right-0 z-20 overflow-x-auto scrollbar-hide flex gap-gap-xs px-gutter"
    >
      {chips.map((cat, i) => {
        const isActive = active === cat.value;
        const chipClass = cn(
          "shrink-0 inline-flex items-center gap-[6px] px-[14px] py-2 rounded-full border font-lv-display text-small font-medium whitespace-nowrap transition-all duration-500 ease-outquint",
          isActive
            ? "border-verde-400 bg-verde-400 text-verde-950 shadow-soft"
            : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
        );
        const iconClass = cn(
          "transition-transform duration-500 ease-outquint",
          isActive && "scale-110",
        );

        return (
          <motion.button
            key={cat.value}
            type="button"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.03, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.92 }}
            onClick={() => onSelect?.(cat.value)}
            aria-pressed={isActive}
            className={chipClass}
          >
            {cat.icon ? (
              <CategoryIcon icon={cat.icon} size={16} strokeWidth={1.8} className={iconClass} />
            ) : (
              <LayoutGrid size={16} strokeWidth={1.8} className={iconClass} />
            )}
            {cat.label}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
