"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";

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
    // `lv-grid-glow` es el cielo del hero de la landing: el único fondo oscuro
    // del sistema. `lv-grain` le quita el aspecto plano al degradado.
    <div
      className={cn(
        "lv-grid-glow lv-grain absolute inset-0 z-20 flex flex-col items-center justify-center text-center text-white transition-all duration-500",
        hidden ? "scale-110 opacity-0 pointer-events-none" : "",
      )}
    >
      <Logo className="h-[72px] w-auto mb-6 animate-pulse-ring" />
      <div className="font-lv-display text-[clamp(36px,10vw,56px)] font-bold tracking-[-0.03em] mb-2">
        La Verde
      </div>
      <div className="text-lead text-white/70 mb-12">
        Encuentra tu lugar en Cuba
      </div>
      <div className="text-small text-white/35">Comenzando...</div>
    </div>
  );
}
