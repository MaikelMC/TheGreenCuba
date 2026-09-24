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

/* Los puntos iban en lv-blue, lv-teal y lv-amber, que no son del sistema. Aquí
   la moneda no se distingue por color — el rótulo ya la dice — así que todos
   bajan a la paleta verde/arena. */
const DEFAULT_OPTIONS: PaymentOption[] = [
  { id: "MLC", label: "USD Clásica", dotColor: "bg-verde-400" },
  { id: "CUP", label: "CUP", dotColor: "bg-verde-300" },
  { id: "USD", label: "USD (efectivo)", dotColor: "bg-verde-600" },
  { id: "EUR", label: "EUR", dotColor: "bg-verde-200" },
  { id: "card", label: "Tarjeta", dotColor: "bg-sand-deep", icon: <CreditCard size={14} strokeWidth={1.8} /> },
  { id: "transfer", label: "Transferencia", dotColor: "bg-sand-deep", icon: <DollarSign size={14} strokeWidth={1.8} /> },
];

export function PaymentChips({
  options = DEFAULT_OPTIONS,
  defaultSelected = ["MLC", "CUP"],
  onChange,
  className,
}: PaymentChipsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));

  /* El `onChange` va **fuera** del actualizador de estado, y no dentro como
     estaba. React ejecuta el actualizador durante el render —y dos veces en
     modo estricto—, así que llamar ahí al `setState` del padre es avisar a otro
     componente mientras se pinta este: «Cannot update a component while
     rendering a different component». El actualizador tiene que ser puro; el
     aviso al padre es un efecto de un clic, no del cálculo. */
  const toggle = useCallback(
    (id: string) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelected(next);
      onChange?.(Array.from(next));
    },
    [selected, onChange],
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
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-[6px] px-[14px] py-2 rounded-full border font-lv-display text-small font-medium cursor-pointer select-none transition-all duration-500 ease-outquint active:scale-[0.98]",
              isActive
                ? "border-verde-400 bg-verde-400 text-verde-950 shadow-soft"
                : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
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
