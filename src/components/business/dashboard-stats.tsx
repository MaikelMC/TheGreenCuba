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

const changeStyles: Record<string, string> = {
  up: "text-lv-teal bg-lv-teal/10",
  down: "text-destructive bg-destructive/10",
  neutral: "text-muted-foreground bg-muted",
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
            className="bg-surface border border-border rounded-lv-lg p-gap-md flex flex-col gap-gap-xs transition-shadow duration-normal hover:shadow-lv-sm"
          >
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-[0.04em] font-medium">
              {s.label}
            </span>
            <span className="font-display text-[clamp(28px,6vw,36px)] font-bold text-foreground tracking-[-0.02em] leading-none">
              {s.value}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-[4px] font-mono text-xs font-medium px-[6px] py-[2px] rounded-sm w-fit",
                changeStyles[s.change.direction],
              )}
            >
              <Icon size={12} strokeWidth={2} />
              {s.change.value}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
