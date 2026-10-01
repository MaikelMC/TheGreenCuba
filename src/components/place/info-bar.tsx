"use client";

import { CalendarDays, Clock, MapPin, Megaphone, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoBarProps {
  schedule: string;
  barrio: string;
  category: string;
  isProject?: boolean;
  className?: string;
}

/* El aire de cada celda vive aquí porque las tres lo comparten. */
const CELL =
  "flex-1 flex flex-col items-center justify-center gap-[4px] py-gap-sm px-gap-xs bg-sand-warm text-center min-h-[72px]";
const LABEL =
  "font-lv-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft/75";
const VALUE = "font-lv-display text-small font-semibold text-ink leading-tight";

export function InfoBar({
  schedule,
  barrio,
  category,
  isProject = false,
  className,
}: InfoBarProps) {
  return (
    <div
      className={cn(
        "flex gap-[1px] bg-ink/5 border-t border-b border-ink/5 lg:border lg:rounded-2xl lg:overflow-hidden",
        className,
      )}
    >
      {/* Horario. Antes se pisaba con "Cerrado" cuando el negocio estaba cerrado:
         el chip de la cabecera ya lo dice, y aquí se perdía el horario, que es
         justo el dato que se viene a buscar a esta celda. */}
      <div className={CELL}>
        {isProject ? (
          <CalendarDays
            size={20}
            strokeWidth={1.8}
            className="text-verde-600"
          />
        ) : (
          <Clock size={20} strokeWidth={1.8} className="text-verde-600" />
        )}
        <span className={LABEL}>{isProject ? "Fechas" : "Horario"}</span>
        <span className={VALUE}>{schedule}</span>
      </div>

      <span className="text-ink/10">|</span>

      {/* Categoría. Muestra la categoría del lugar. */}
      <div className={CELL}>
        {isProject ? (
          <Megaphone size={14} strokeWidth={1.8} className="text-verde-600" />
        ) : (
          <Utensils size={14} strokeWidth={1.8} className="text-verde-600" />
        )}
        <span className={LABEL}>{isProject ? "Proyecto" : "Categoría"}</span>
        <span className={VALUE}>{category}</span>
      </div>
    </div>
  );
}
