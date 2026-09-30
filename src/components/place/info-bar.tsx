"use client";

import { CalendarDays, Clock, MapPin, CreditCard } from "lucide-react";
import { cn, currencyLabel, currencyStyles } from "@/lib/utils";

interface InfoBarProps {
  schedule: string;
  barrio: string;
  payments: string[];
  isProject?: boolean;
  className?: string;
}

/* El aire de cada celda vive aquí porque las tres lo comparten. */
const CELL = "flex-1 flex flex-col items-center justify-center gap-[4px] py-gap-sm px-gap-xs bg-sand-warm text-center min-h-[72px]";
const LABEL = "font-lv-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft/75";
const VALUE = "font-lv-display text-small font-semibold text-ink leading-tight";

export function InfoBar({
  schedule,
  barrio,
  payments,
  isProject = false,
  className,
}: InfoBarProps) {
  return (
    <div className={cn("flex gap-[1px] bg-ink/5 border-t border-b border-ink/5 lg:border lg:rounded-2xl lg:overflow-hidden", className)}>
      {/* Horario. Antes se pisaba con "Cerrado" cuando el negocio estaba cerrado:
         el chip de la cabecera ya lo dice, y aquí se perdía el horario, que es
         justo el dato que se viene a buscar a esta celda. */}
      <div className={CELL}>
        {isProject ? <CalendarDays size={20} strokeWidth={1.8} className="text-verde-600" /> : <Clock size={20} strokeWidth={1.8} className="text-verde-600" />}
        <span className={LABEL}>{isProject ? "Fechas" : "Horario"}</span>
        <span className={VALUE}>{schedule}</span>
      </div>

      {/* Barrio. La celda decía "Distancia", pero el valor que recibía era el
         mismo cajón de sastre —distancia, dirección o barrio— que ya se pinta
         arriba: lo normal era ver el mismo texto dos veces en la misma
         pantalla. El barrio, en cambio, no salía en ningún otro sitio. */}
      <div className={CELL}>
        <MapPin size={20} strokeWidth={1.8} className="text-verde-600" />
        <span className={LABEL}>{isProject ? "Sede" : "Barrio"}</span>
        <span className={VALUE}>{barrio}</span>
      </div>

      {/* Pagos */}
      {!isProject && (
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
      )}
    </div>
  );
}
