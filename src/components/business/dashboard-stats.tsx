"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";

interface StatChange {
  value: string;
  direction: "up" | "down" | "neutral";
}

interface StatCard {
  label: string;
  value: string;
  change: StatChange;
}

interface DashboardStatsProps {
  stats: StatCard[];
  className?: string;
}

/* Subir es buena noticia, así que va en verde del sistema. Bajar no es un
   error del negocio, solo una caída: por eso el tinte apagado de arena y no
   el rojo de destructivo, que aquí alarmaría de más. */
const changeStyles: Record<string, string> = {
  up: "text-verde-600 bg-verde-50",
  down: "text-ink-soft/75 bg-sand-deep",
  neutral: "text-ink-soft/75 bg-sand-deep",
};

const changeIcons: Record<StatChange["direction"], LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

export function DashboardStats({ stats, className }: DashboardStatsProps) {
  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-gap-sm", className)}>
      {stats.map((s, i) => {
        const Icon = changeIcons[s.change.direction] ?? Minus;
        return (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -3 }}
            className="bg-white border border-ink/5 rounded-2xl p-gap-md flex flex-col gap-gap-xs shadow-soft transition-shadow duration-500 ease-outquint hover:shadow-card"
          >
            <span className="font-lv-display text-[10px] font-semibold text-verde-600 uppercase tracking-[0.22em]">
              {s.label}
            </span>
            <span className="font-lv-display text-[clamp(28px,6vw,36px)] font-bold text-ink tracking-[-0.02em] leading-none">
              {s.value}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-[4px] font-lv-display text-meta font-medium px-[8px] py-[3px] rounded-full w-fit",
                changeStyles[s.change.direction],
              )}
            >
              <Icon size={12} strokeWidth={1.8} />
              {s.change.value}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
