"use client";

import { Clock, MapPin, CreditCard } from "lucide-react";
import { cn, currencyLabel } from "@/lib/utils";

interface InfoBarProps {
  schedule: string;
  distance: string;
  payments: string[];
  isOpen: boolean;
  closedLabel?: string;
  className?: string;
}

/* Mismo mapa que los chips de pago del panel de negocio: la moneda no se
   distingue por color — el rótulo ya la dice — así que todas bajan a la escala
   verde/arena. Antes eran lv-blue y lv-teal, que no son del sistema. */
const currencyStyles: Record<string, string> = {
  MLC: "bg-verde-100 text-verde-700",
  CUP: "bg-verde-50 text-verde-600",
  USD: "bg-sand-deep text-ink-soft/75",
  EUR: "bg-sand-deep text-ink-soft/75",
};

/* El aire de cada celda vive aquí porque las tres lo comparten. */
const CELL = "flex-1 flex flex-col items-center justify-center gap-[4px] py-gap-sm px-gap-xs bg-sand-warm text-center min-h-[72px]";
const LABEL = "font-lv-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft/75";
const VALUE = "font-lv-display text-small font-semibold text-ink leading-tight";

export function InfoBar({
  schedule,
  distance,
  payments,
  isOpen,
  closedLabel,
  className,
}: InfoBarProps) {
  return (
    <div className={cn("flex gap-[1px] bg-ink/5 border-t border-b border-ink/5 lg:border lg:rounded-2xl lg:overflow-hidden", className)}>
      {/* Horario */}
      <div className={CELL}>
        <Clock size={20} strokeWidth={1.8} className="text-verde-600" />
        <span className={LABEL}>Horario</span>
        <span className={cn(VALUE, !isOpen && "text-destructive")}>
          {isOpen ? schedule : closedLabel ?? "Cerrado"}
        </span>
      </div>

      {/* Distancia */}
      <div className={CELL}>
        <MapPin size={20} strokeWidth={1.8} className="text-verde-600" />
        <span className={LABEL}>Distancia</span>
        <span className={VALUE}>{distance}</span>
      </div>

      {/* Pagos */}
      <div className={CELL}>
        <CreditCard size={20} strokeWidth={1.8} className="text-verde-600" />
        <span className={LABEL}>Pagos</span>
        <div className="flex gap-[4px] justify-center flex-wrap">
          {payments.map((c) => (
            <span
              key={c}
              className={cn(
                "px-[6px] py-[2px] rounded-full font-lv-display text-[10px] font-semibold uppercase tracking-[0.08em]",
                currencyStyles[c] ?? "bg-sand-deep text-ink-soft/75",
              )}
            >
              {currencyLabel(c)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
