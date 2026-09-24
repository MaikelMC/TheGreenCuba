"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface DayHours {
  day: string;
  open: string;
  close: string;
  isClosed?: boolean;
}

interface HoursEditorProps {
  hours?: DayHours[];
  onChange?: (hours: DayHours[]) => void;
  className?: string;
}

const DEFAULT_HOURS: DayHours[] = [
  { day: "Lun", open: "11:00", close: "23:00" },
  { day: "Mar", open: "11:00", close: "23:00" },
  { day: "Mié", open: "11:00", close: "23:00" },
  { day: "Jue", open: "11:00", close: "00:00" },
  { day: "Vie", open: "11:00", close: "01:00" },
  { day: "Sáb", open: "11:00", close: "01:00" },
  { day: "Dom", open: "Cerrado", close: "", isClosed: true },
];

/* `min-w-0` es obligatorio aquí. Un `<input>` es un elemento de reemplazo, así
   que como ítem de flex tiene `min-width: auto` y no baja de su ancho
   intrínseco (unos 177 px por defecto). Con dos campos por fila la fila pedía
   más de 400 px y en móvil se salía de la tarjeta. */
const FIELD =
  "flex-1 min-w-0 h-11 px-2 sm:px-gap-sm border rounded-xl font-lv-display text-small text-center bg-white text-ink outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

export function HoursEditor({
  hours = DEFAULT_HOURS,
  onChange,
  className,
}: HoursEditorProps) {
  const [items, setItems] = useState(hours);

  /* Mismo arreglo que en los otros dos editores: el `onChange` sale del
     actualizador. Ver `menu-item-editor.tsx`. */
  const update = useCallback(
    (index: number, field: keyof DayHours, value: string | boolean) => {
      const next = items.map((h, i) => (i === index ? { ...h, [field]: value } : h));
      setItems(next);
      onChange?.(next);
    },
    [items, onChange],
  );

  const toggleClosed = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      const wasClosed = item.isClosed;
      const next = items.map((h, i) =>
        i === index
          ? {
              ...h,
              isClosed: !wasClosed,
              open: wasClosed ? "12:00" : "Cerrado",
              close: wasClosed ? "00:00" : "",
            }
          : h,
      );
      setItems(next);
      onChange?.(next);
    },
    [items, onChange],
  );

  return (
    <div className={cn("flex flex-col gap-gap-xs", className)}>
      {items.map((item, i) => (
        <div key={item.day} className="flex items-center gap-2 sm:gap-gap-sm py-gap-xs">
          <span className="w-[34px] sm:w-[40px] font-lv-display text-meta font-semibold text-ink-soft/75 uppercase shrink-0">
            {item.day}
          </span>

          <input
            type="text"
            value={item.open}
            onChange={(e) => update(i, "open", e.target.value)}
            onClick={() => item.isClosed && toggleClosed(i)}
            readOnly={item.isClosed}
            className={cn(
              FIELD,
              item.isClosed
                ? "border-ink/5 bg-sand text-ink-soft/75 cursor-pointer"
                : "border-ink/10",
            )}
            aria-label={`Apertura ${item.day}`}
          />

          <span className="font-lv-display text-meta text-ink-soft/75">—</span>

          <input
            type="text"
            value={item.close}
            onChange={(e) => update(i, "close", e.target.value)}
            onClick={() => item.isClosed && toggleClosed(i)}
            readOnly={item.isClosed}
            className={cn(
              FIELD,
              item.isClosed
                ? "border-ink/5 bg-sand text-ink-soft/75 cursor-pointer"
                : "border-ink/10",
            )}
            aria-label={`Cierre ${item.day}`}
          />
        </div>
      ))}
    </div>
  );
}
