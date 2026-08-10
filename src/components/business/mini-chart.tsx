"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface MiniChartProps {
  data: number[];
  labels?: ReactNode[];
  title?: string;
  period?: string;
  className?: string;
}

export function MiniChart({
  data,
  labels,
  title = "Visitas por día",
  period = "Últimos 14 días",
  className,
}: MiniChartProps) {
  const max = Math.max(...data, 1);

  return (
    <div className={cn("bg-surface border border-border rounded-lv-lg p-gap-md", className)}>
      <div className="flex items-center justify-between mb-gap-md">
        <span className="font-display text-small font-semibold text-foreground">{title}</span>
        <span className="font-mono text-xs text-muted-foreground px-[8px] py-[3px] bg-muted rounded-sm">
          {period}
        </span>
      </div>

      <div className="h-[120px] relative flex items-end gap-[3px]">
        {data.map((val, i) => (
          <div
            key={i}
            className="flex-1 relative group"
            style={{ height: `${(val / max) * 100}%` }}
          >
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.1 + i * 0.03, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: "bottom", height: "100%", minHeight: "4px" }}
              className={cn(
                "absolute bottom-0 inset-x-0 rounded-t-sm transition-colors duration-fast cursor-pointer",
                i === data.length - 1 ? "bg-accent" : "bg-accent/20 hover:bg-accent",
              )}
            >
              <div className="hidden group-hover:block absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 bg-foreground text-surface font-mono text-xs px-[8px] py-[3px] rounded-sm whitespace-nowrap pointer-events-none z-10">
                {val} visitas
              </div>
            </motion.div>
          </div>
        ))}
      </div>

      {labels && (
        <div className="flex justify-between mt-gap-xs">
          {labels.map((l, i) => (
            <span key={i} className="font-mono text-[10px] text-muted-foreground">
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
