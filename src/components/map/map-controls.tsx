"use client";

import { Plus, Minus, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

interface MapControlsProps {
  className?: string;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onLocate?: () => void;
}

export function MapControls({ className, onZoomIn, onZoomOut, onLocate }: MapControlsProps) {
  return (
    <div className={cn("z-20", className)}>
      <div className="flex flex-col gap-[2px]">
        <button
          onClick={onZoomIn}
          className="size-10 bg-surface border border-border grid place-items-center text-foreground rounded-t-sm hover:bg-background transition-colors"
          aria-label="Acercar"
        >
          <Plus size={18} strokeWidth={2} />
        </button>
        <button
          onClick={onZoomOut}
          className="size-10 bg-surface border border-border grid place-items-center text-foreground rounded-b-sm border-t-0 hover:bg-background transition-colors"
          aria-label="Alejar"
        >
          <Minus size={18} strokeWidth={2} />
        </button>
      </div>
      <button
        onClick={onLocate}
        className="size-11 bg-surface border border-border rounded-full grid place-items-center text-accent shadow-lv-sm hover:bg-accent/10 hover:shadow-lv-md transition-all"
        aria-label="Mi ubicación"
      >
        <Crosshair size={20} strokeWidth={2} />
      </button>
    </div>
  );
}
