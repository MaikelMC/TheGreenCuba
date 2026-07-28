"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type ButtonHTMLAttributes } from "react";

interface PreferenceChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: ReactNode;
  label: string;
}

export function PreferenceChip({ selected, icon, label, className, ...props }: PreferenceChipProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 px-[18px] py-2.5 rounded-full border-[1.5px] font-display text-small font-medium transition-all duration-200 select-none",
        selected
          ? "border-accent bg-accent text-white"
          : "border-border bg-surface text-foreground hover:border-accent hover:bg-accent/10 hover:text-accent",
        className,
      )}
      {...props}
    >
      {icon && <span className="size-[18px] flex-shrink-0">{icon}</span>}
      {label}
    </button>
  );
}
