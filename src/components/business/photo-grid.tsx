"use client";

import { useState } from "react";
import { Image, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoSlot {
  id: string;
  filled?: boolean;
  isCover?: boolean;
  gradient?: string;
}

interface PhotoGridProps {
  slots?: PhotoSlot[];
  maxSlots?: number;
  onAdd?: () => void;
  onRemove?: (id: string) => void;
  className?: string;
}

const FILLED_SLOTS: PhotoSlot[] = [
  { id: "1", filled: true, isCover: true, gradient: "linear-gradient(135deg, oklch(62% 0.16 145 / 0.12), oklch(75% 0.15 75 / 0.08))" },
  { id: "2", filled: true, gradient: "linear-gradient(135deg, oklch(75% 0.15 75 / 0.10), oklch(62% 0.16 145 / 0.06))" },
  { id: "3", filled: true, gradient: "linear-gradient(135deg, oklch(62% 0.14 250 / 0.08), oklch(62% 0.16 145 / 0.05))" },
];

const EMPTY_SLOTS: PhotoSlot[] = [
  { id: "add-1", filled: false },
  { id: "add-2", filled: false },
];

export function PhotoGrid({
  slots = [...FILLED_SLOTS, ...EMPTY_SLOTS],
  onAdd,
  onRemove,
  className,
}: PhotoGridProps) {
  return (
    <div>
      <p className="form-hint text-meta text-muted-foreground mb-gap-md">
        Sube fotos de tu negocio. La primera será la foto de portada.
      </p>
      <div className={cn("grid grid-cols-3 lg:grid-cols-4 gap-gap-xs", className)}>
        {slots.map((slot) => {
          if (!slot.filled) {
            return (
              <button
                key={slot.id}
                type="button"
                onClick={onAdd}
                className="aspect-square rounded-lv border-2 border-dashed border-border flex flex-col items-center justify-center gap-[4px] cursor-pointer text-muted-foreground hover:border-accent hover:bg-accent/10 hover:text-accent transition-all duration-fast"
              >
                <Plus size={24} strokeWidth={1.5} />
                <span className="font-mono text-[10px] uppercase tracking-[0.04em]">Añadir</span>
              </button>
            );
          }

          return (
            <div
              key={slot.id}
              className={cn(
                "relative rounded-lv border-2 border-solid border-border overflow-hidden group",
                slot.isCover && "col-span-full aspect-[16/9]",
                !slot.isCover && "aspect-square",
              )}
            >
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: slot.gradient }}
              >
                <Image
                  size={slot.isCover ? 32 : 24}
                  strokeWidth={1.5}
                  className="opacity-40"
                  style={{ color: "var(--accent)" }}
                />
              </div>
              <button
                type="button"
                onClick={() => onRemove?.(slot.id)}
                className="absolute top-[4px] right-[4px] size-6 rounded-full bg-foreground/70 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                aria-label="Eliminar foto"
              >
                <X size={14} strokeWidth={2} />
              </button>
              {slot.isCover && (
                <span className="absolute bottom-[6px] left-[6px] bg-[oklch(0%_0_0/0.5)] text-white px-[6px] py-[2px] rounded text-[9px] font-medium">
                  Portada
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
