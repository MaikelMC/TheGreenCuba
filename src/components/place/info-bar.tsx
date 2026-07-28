"use client";

import { Clock, MapPin, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoBarProps {
  schedule: string;
  distance: string;
  payments: string[];
  isOpen: boolean;
  closedLabel?: string;
  className?: string;
}

const currencyStyles: Record<string, string> = {
  MLC: "bg-accent/12 text-accent",
  CUP: "bg-lv-blue/10 text-lv-blue",
  USD: "bg-lv-teal/10 text-lv-teal",
};

export function InfoBar({
  schedule,
  distance,
  payments,
  isOpen,
  closedLabel,
  className,
}: InfoBarProps) {
  return (
    <div className={cn("flex gap-[1px] bg-border border-t border-b border-border lg:border lg:rounded-lv-lg lg:overflow-hidden", className)}>
      {/* Horario */}
      <div className="flex-1 flex flex-col items-center justify-center gap-[4px] py-gap-sm px-gap-xs bg-surface text-center min-h-[72px]">
        <Clock size={20} strokeWidth={2} className="text-accent" />
        <span className="font-mono text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
          Horario
        </span>
        <span
          className={cn(
            "font-display text-small font-semibold text-foreground leading-tight",
            !isOpen && "text-destructive",
          )}
        >
          {isOpen ? schedule : closedLabel ?? "Cerrado"}
        </span>
      </div>

      {/* Distancia */}
      <div className="flex-1 flex flex-col items-center justify-center gap-[4px] py-gap-sm px-gap-xs bg-surface text-center min-h-[72px]">
        <MapPin size={20} strokeWidth={2} className="text-accent" />
        <span className="font-mono text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
          Distancia
        </span>
        <span className="font-display text-small font-semibold text-foreground leading-tight">
          {distance}
        </span>
      </div>

      {/* Pagos */}
      <div className="flex-1 flex flex-col items-center justify-center gap-[4px] py-gap-sm px-gap-xs bg-surface text-center min-h-[72px]">
        <CreditCard size={20} strokeWidth={2} className="text-accent" />
        <span className="font-mono text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
          Pagos
        </span>
        <div className="flex gap-[4px] justify-center flex-wrap">
          {payments.map((c) => (
            <span
              key={c}
              className={cn(
                "px-[6px] py-[2px] rounded-sm font-mono text-[10px] font-medium tracking-[0.02em]",
                currencyStyles[c] ?? "bg-muted text-muted-foreground",
              )}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
