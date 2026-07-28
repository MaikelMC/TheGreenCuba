"use client";

import { useState, useCallback } from "react";
import { CreditCard, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentOption {
  id: string;
  label: string;
  dotColor: string;
  icon?: React.ReactNode;
}

interface PaymentChipsProps {
  options?: PaymentOption[];
  defaultSelected?: string[];
  onChange?: (selected: string[]) => void;
  className?: string;
}

const DEFAULT_OPTIONS: PaymentOption[] = [
  { id: "MLC", label: "MLC", dotColor: "bg-accent" },
  { id: "CUP", label: "CUP", dotColor: "bg-lv-blue" },
  { id: "USD", label: "USD (efectivo)", dotColor: "bg-lv-teal" },
  { id: "EUR", label: "EUR", dotColor: "bg-lv-amber" },
  { id: "card", label: "Tarjeta", dotColor: "bg-muted-foreground", icon: <CreditCard size={14} strokeWidth={2} /> },
  { id: "transfer", label: "Transferencia", dotColor: "bg-muted-foreground", icon: <DollarSign size={14} strokeWidth={2} /> },
];

export function PaymentChips({
  options = DEFAULT_OPTIONS,
  defaultSelected = ["MLC", "CUP"],
  onChange,
  className,
}: PaymentChipsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));

  const toggle = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange?.(Array.from(next));
        return next;
      });
    },
    [onChange],
  );

  return (
    <div className={cn("flex flex-wrap gap-gap-xs", className)}>
      {options.map((opt) => {
        const isActive = selected.has(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            className={cn(
              "inline-flex items-center gap-[6px] px-[14px] py-[6px] rounded-full border font-mono text-xs font-medium cursor-pointer select-none transition-all duration-fast",
              isActive
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface text-foreground hover:border-accent",
            )}
          >
            {opt.icon ? (
              opt.icon
            ) : (
              <span className={cn("size-2 rounded-full", opt.dotColor)} />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
