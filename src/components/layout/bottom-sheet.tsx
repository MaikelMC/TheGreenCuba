"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type SheetState = "peek" | "full";

interface BottomSheetProps {
  children: ReactNode;
  title: string | ReactNode;
  subtitle?: string;
  badge?: string;
  className?: string;
  defaultState?: SheetState;
}

export function BottomSheet({
  children,
  title,
  subtitle,
  badge,
  className,
  defaultState = "peek",
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [state, setState] = useState<SheetState>(defaultState);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startTranslate = useRef(0);
  const didDrag = useRef(false);
  const dragRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const translateY =
    isDragging
      ? `${dragRef.current}px`
      : state === "peek"
        ? "calc(100% - 120px)"
        : "0px";

  function cycleState() {
    setState((prev) => (prev === "peek" ? "full" : "peek"));
  }

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      startY.current = e.clientY;
      didDrag.current = false;

      const style = getComputedStyle(sheet);
      const matrix = new DOMMatrixReadOnly(style.transform);
      startTranslate.current = matrix.m42;
      setIsDragging(true);
      sheet.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const dy = ev.clientY - startY.current;
        if (Math.abs(dy) > 5) didDrag.current = true;
        const maxUp = -(window.innerHeight * 0.7);
        dragRef.current = Math.min(0, Math.max(startTranslate.current + dy, maxUp));
        setIsDragging(true);
      };

      const onUp = () => {
        sheet.removeEventListener("pointermove", onMove);
        sheet.removeEventListener("pointerup", onUp);

        if (didDrag.current) {
          const vh = window.innerHeight;
          const ratio = -dragRef.current / vh;
          setIsDragging(false);
          setState(ratio > 0.3 ? "full" : "peek");
        } else {
          setIsDragging(false);
          cycleState();
        }
      };

      sheet.addEventListener("pointermove", onMove);
      sheet.addEventListener("pointerup", onUp);
    },
    [],
  );

  return (
    <div
      ref={sheetRef}
      data-state={state}
      className={cn(
        "fixed left-0 right-0 bottom-0 z-300 bg-surface rounded-t-lv-xl shadow-[0_-4px_24px_oklch(18%_0.01_250_/_0.12)] transition-[transform] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] max-h-[70vh] flex flex-col pb-safe-bottom",
        mounted && "bottom-sheet-desktop",
        isDragging && "!transition-none",
        className,
      )}
      style={{ transform: `translateY(${translateY})` }}
    >
      {/* Handle */}
      <div
        className="flex justify-center py-[10px] pb-[6px] cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={handlePointerDown}
      >
        <div className="w-[36px] h-[4px] bg-border rounded-full" />
      </div>

      {/* Header */}
      <div className="px-5 pb-gap-sm border-b border-border shrink-0">
        <h2 className="font-display text-[18px] font-bold tracking-[-0.01em] flex items-center gap-gap-xs">
          {title}
          {badge && (
            <span className="font-mono text-[10px] font-medium bg-accent/10 text-accent px-2 py-[2px] rounded-full tracking-[0.06em] uppercase">
              {badge}
            </span>
          )}
        </h2>
        {subtitle && (
          <p className="text-[14px] text-muted-foreground mt-[4px]">{subtitle}</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-gutter py-gap-sm pb-gutter scrollbar-hide">
        {children}
      </div>

      {/* Scroll fade */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-surface to-transparent pointer-events-none z-[5]" />
    </div>
  );
}
