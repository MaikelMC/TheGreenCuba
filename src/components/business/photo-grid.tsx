"use client";

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

/* Degradados de relleno mientras no hay foto real, todos dentro de la paleta
   verde/arena. Antes eran `oklch()` crudos de acento, ámbar y azul. */
const FILLED_SLOTS: PhotoSlot[] = [
  { id: "1", filled: true, isCover: true, gradient: "linear-gradient(135deg, #EAF7EF, #CEEEDB)" },
  { id: "2", filled: true, gradient: "linear-gradient(135deg, #F6F3EC, #EAE4D6)" },
  { id: "3", filled: true, gradient: "linear-gradient(135deg, #CEEEDB, #EAF7EF)" },
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
      <p className="text-meta text-ink-soft/75 mb-gap-md">
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
                className="aspect-square rounded-2xl border border-dashed border-ink/10 flex flex-col items-center justify-center gap-[6px] cursor-pointer text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 transition-all duration-500 ease-outquint"
              >
                <Plus size={24} strokeWidth={1.8} />
                <span className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em]">
                  Añadir
                </span>
              </button>
            );
          }

          return (
            <div
              key={slot.id}
              className={cn(
                "relative rounded-2xl border border-ink/5 overflow-hidden group",
                slot.isCover && "col-span-full aspect-[16/9]",
                !slot.isCover && "aspect-square",
              )}
            >
              <div
                className="absolute inset-0 flex items-center justify-center text-verde-400"
                style={{ background: slot.gradient }}
              >
                <Image
                  size={slot.isCover ? 32 : 24}
                  strokeWidth={1.8}
                  className="opacity-40"
                />
              </div>
              <button
                type="button"
                onClick={() => onRemove?.(slot.id)}
                className="absolute top-[6px] right-[6px] size-7 rounded-full bg-ink/70 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-outquint z-10"
                aria-label="Eliminar foto"
              >
                <X size={14} strokeWidth={1.8} />
              </button>
              {slot.isCover && (
                <span className="absolute bottom-[8px] left-[8px] bg-ink/70 text-white px-[10px] py-[3px] rounded-full font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em]">
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
