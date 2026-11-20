"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";

interface CurrencyToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  code: string;
  name: string;
  active?: boolean;
}

export function CurrencyToggle({
  code,
  name,
  active,
  className,
  ...props
}: CurrencyToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={active ?? false}
      className={cn(
        "flex items-center gap-4 px-5 py-4 border rounded-2xl shadow-soft transition duration-500 ease-outquint w-full text-left",
        active
          ? "border-verde-400 bg-verde-50"
          : "border-ink/5 bg-white hover:border-verde-300 hover:bg-verde-50",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition duration-500",
          active ? "bg-verde-400 border-verde-400" : "border-ink/20",
        )}
      >
        {active && (
          <span className="w-2 h-1 border-l-2 border-b-2 border-verde-950 -rotate-45 translate-y-[-1px]" />
        )}
      </span>
      {/* Ancho fijo y no `min-w`, para que todas las tarjetas alineen la
          columna de códigos. Los códigos son de tres letras desde que
          «TRANSFER» pasó a «CUP». */}
      <span className="font-lv-display text-body font-semibold text-ink w-12 flex-shrink-0 whitespace-nowrap">
        {code}
      </span>
      <span className="flex-1 text-small text-ink-soft/75">{name}</span>
    </button>
  );
}
