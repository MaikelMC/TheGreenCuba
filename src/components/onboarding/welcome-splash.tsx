"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface WelcomeSplashProps {
  onComplete: () => void;
}

export function WelcomeSplash({ onComplete }: WelcomeSplashProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHidden(true);
      setTimeout(onComplete, 500);
    }, 1800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center text-center text-white transition-all duration-500",
        "bg-gradient-to-br from-accent to-[oklch(45%_0.13_145)]",
        hidden ? "scale-110 opacity-0 pointer-events-none" : "",
      )}
    >
      <div className="size-[72px] rounded-full bg-white/20 flex items-center justify-center mb-6 animate-pulse-ring">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="size-9 text-white">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
          <path d="M12 6v6l4 2" />
          <path d="M7 12h2" />
          <path d="M15 12h2" />
          <path d="M7 16h10" />
        </svg>
      </div>
      <div className="font-display text-[clamp(36px,10vw,56px)] font-bold tracking-[-0.03em] mb-2">
        La Verde
      </div>
      <div className="text-body opacity-80 mb-12">Descubre Cuba, encuentra tu lugar</div>
      <div className="text-small opacity-60">Comenzando...</div>
    </div>
  );
}
