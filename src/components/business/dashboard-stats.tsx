"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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

const changeIcons: Record<string, typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

export function DashboardStats({ stats, className }: DashboardStatsProps) {
  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-gap-sm", className)}>
      {stats.map((s) => {
        const Icon = changeIcons[s.change.direction];
        return (
          <div
            key={s.label}
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
          </div>
        );
      })}
    </div>
  );
}
