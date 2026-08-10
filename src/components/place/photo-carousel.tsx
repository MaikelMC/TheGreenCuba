"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Image } from "lucide-react";
import { cn } from "@/lib/utils";

interface Slide {
  gradient: string;
  label: string;
}

interface PhotoCarouselProps {
  slides: Slide[];
  hasPhotos?: boolean;
  className?: string;
}

export function PhotoCarousel({ slides, hasPhotos = true, className }: PhotoCarouselProps) {
  const [current, setCurrent] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const isDragging = useRef(false);

  const total = slides.length;
  const goTo = useCallback(
    (i: number) => {
      setCurrent(Math.max(0, Math.min(i, total - 1)));
    },
    [total],
  );

  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(-${current * 100}%)`;
    }
  }, [current]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchDeltaX.current = 0;
    isDragging.current = true;
    if (trackRef.current) trackRef.current.style.transition = "none";
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchDeltaX.current = touch.clientX - touchStartX.current;
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(calc(-${current * 100}% + ${touchDeltaX.current}px))`;
    }
  }, [current]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    if (trackRef.current) trackRef.current.style.transition = "";
    if (Math.abs(touchDeltaX.current) > 50) {
      goTo(touchDeltaX.current > 0 ? current - 1 : current + 1);
    }
  }, [current, goTo]);

  if (!hasPhotos) {
    return (
      <div className={cn("relative w-full aspect-[4/3] lg:aspect-[16/9] overflow-hidden bg-lv-sand-200", className)}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-gap-xs text-muted-foreground">
          <Image size={40} strokeWidth={1.5} className="opacity-40" />
          <span className="text-small font-mono">Fotos próximamente</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("group relative w-full aspect-[4/3] lg:aspect-[16/9] overflow-hidden bg-lv-sand-200 lg:rounded-lv-xl", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div ref={trackRef} className="flex h-full transition-transform duration-slow ease-out will-change-transform">
        {slides.map((slide, i) => (
          <div key={i} className="flex-[0_0_100%] h-full relative">
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-gap-xs text-muted-foreground"
              style={{ background: slide.gradient }}
            >
              <Image size={40} strokeWidth={1.5} className="opacity-40" style={{ color: "oklch(80% 0.10 145)" }} />
              <span className="text-small font-mono" style={{ color: "oklch(85% 0.06 145)" }}>
                {slide.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Counter */}
      <div className="absolute top-gap-xs right-gap-xs bg-[oklch(15%_0.01_250_/_0.65)] backdrop-blur-sm text-white font-mono text-xs font-medium px-[10px] py-[4px] rounded-full">
        {current + 1} / {total}
      </div>

      {/* Dots */}
      <div className="absolute bottom-gap-xs left-1/2 -translate-x-1/2 flex gap-[6px]">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            className={cn(
              "h-[7px] rounded-full transition-all duration-normal",
              i === current
                ? "w-[20px] bg-white"
                : "w-[7px] bg-white/50 border border-white/30",
            )}
            aria-label={`Ir a foto ${i + 1}`}
          />
        ))}
      </div>

      {/* Nav buttons */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            className="absolute top-1/2 -translate-y-1/2 left-gap-xs size-9 rounded-full bg-white/85 backdrop-blur grid place-items-center shadow-lv-sm opacity-0 group-hover:opacity-100 hover:bg-white hover:shadow-lv-md transition-all duration-fast"
            aria-label="Foto anterior"
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            className="absolute top-1/2 -translate-y-1/2 right-gap-xs size-9 rounded-full bg-white/85 backdrop-blur grid place-items-center shadow-lv-sm opacity-0 group-hover:opacity-100 hover:bg-white hover:shadow-lv-md transition-all duration-fast"
            aria-label="Foto siguiente"
          >
            <ChevronRight size={18} strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  );
}
