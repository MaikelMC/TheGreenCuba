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
        "inline-flex items-center gap-2 px-[18px] py-2.5 rounded-full border font-lv-display text-small font-medium transition-all duration-500 ease-outquint select-none active:scale-[0.98]",
        selected
          ? "border-verde-400 bg-verde-400 text-verde-950"
          : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
        className,
      )}
      {...props}
    >
      {icon && <span className="size-[18px] flex-shrink-0">{icon}</span>}
      {label}
    </button>
  );
}
