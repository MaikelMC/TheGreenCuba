"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";

interface CurrencyToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  code: string;
  name: string;
  badge: string;
  active?: boolean;
  badgeVariant?: "mlc" | "cup" | "usd" | "eur";
}

const badgeStyles: Record<string, string> = {
  mlc: "bg-accent/10 text-accent",
  cup: "bg-[oklch(62%_0.14_250_/_0.10)] text-lv-blue",
  usd: "bg-[oklch(70%_0.12_175_/_0.10)] text-lv-teal",
  eur: "bg-[oklch(75%_0.15_75_/_0.10)] text-lv-amber",
};

export function CurrencyToggle({
  code,
  name,
  badge,
  active,
  badgeVariant = "mlc",
  className,
  ...props
}: CurrencyToggleProps) {
  return (
    <button
      className={cn(
        "flex items-center gap-4 px-5 py-4 border-[1.5px] rounded-lv-lg transition-all duration-200",
        active ? "border-accent bg-accent/10" : "border-border hover:border-accent",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "size-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200",
          active ? "bg-accent border-accent" : "border-border",
        )}
      >
        {active && (
          <span className="w-2 h-1 border-l-2 border-b-2 border-white -rotate-45 translate-y-[-1px]" />
        )}
      </span>
      <span className="font-mono text-body font-semibold w-12 flex-shrink-0">{code}</span>
      <span className="flex-1 text-small text-muted-foreground">{name}</span>
      <span
        className={cn(
          "font-mono text-xs px-2 py-0.5 rounded-sm font-medium",
          badgeStyles[badgeVariant],
        )}
      >
        {badge}
      </span>
    </button>
  );
}
