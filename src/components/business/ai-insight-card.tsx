"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIInsightCardProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export function AIInsightCard({
  label = "Insight de la IA",
  children,
  className,
}: AIInsightCardProps) {
  return (
    <div
      className={cn(
        "bg-gradient-to-br from-accent/[0.06] to-accent/[0.02] border border-accent/15 rounded-lv-lg p-gap-md flex gap-gap-sm items-start",
        className,
      )}
    >
      <div className="size-10 rounded-lv bg-accent grid place-items-center shrink-0 text-white">
        <Sparkles size={20} strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs text-accent uppercase tracking-[0.04em] font-medium mb-[4px]">
          {label}
        </div>
        <div className="text-small leading-relaxed text-foreground [&_strong]:font-semibold">
          {children}
        </div>
      </div>
    </div>
  );
}
