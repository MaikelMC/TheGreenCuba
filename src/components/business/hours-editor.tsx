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

export function HoursEditor({
  hours = DEFAULT_HOURS,
  onChange,
  className,
}: HoursEditorProps) {
  const [items, setItems] = useState(hours);

  const update = useCallback(
    (index: number, field: keyof DayHours, value: string | boolean) => {
      setItems((prev) => {
        const next = prev.map((h, i) => (i === index ? { ...h, [field]: value } : h));
        onChange?.(next);
        return next;
      });
    },
    [onChange],
  );

  const toggleClosed = useCallback(
    (index: number) => {
      setItems((prev) => {
        const item = prev[index];
        const wasClosed = item.isClosed;
        const next = prev.map((h, i) =>
          i === index
            ? {
                ...h,
                isClosed: !wasClosed,
                open: wasClosed ? "12:00" : "Cerrado",
                close: wasClosed ? "00:00" : "",
              }
            : h,
        );
        onChange?.(next);
        return next;
      });
    },
    [onChange],
  );

  return (
    <div className={cn("flex flex-col gap-gap-xs", className)}>
      {items.map((item, i) => (
        <div key={item.day} className="flex items-center gap-gap-sm py-gap-xs">
          <span className="w-[40px] font-mono text-xs font-medium text-muted-foreground uppercase shrink-0">
            {item.day}
          </span>

          <input
            type="text"
            value={item.open}
            onChange={(e) => update(i, "open", e.target.value)}
            onClick={() => item.isClosed && toggleClosed(i)}
            readOnly={item.isClosed}
            className={cn(
              "flex-1 h-10 px-gap-sm border border-border rounded-sm font-mono text-small text-center outline-none transition-colors duration-fast focus:border-accent",
              item.isClosed && "bg-muted text-muted-foreground cursor-pointer",
            )}
            aria-label={`Apertura ${item.day}`}
          />

          <span className="font-mono text-xs text-muted-foreground">—</span>

          <input
            type="text"
            value={item.close}
            onChange={(e) => update(i, "close", e.target.value)}
            readOnly={item.isClosed}
            className={cn(
              "flex-1 h-10 px-gap-sm border border-border rounded-sm font-mono text-small text-center outline-none transition-colors duration-fast focus:border-accent",
              item.isClosed && "bg-muted text-muted-foreground cursor-pointer",
            )}
            aria-label={`Cierre ${item.day}`}
          />
        </div>
      ))}
    </div>
  );
}
