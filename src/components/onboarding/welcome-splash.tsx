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
    <div
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center text-center text-white transition-all duration-500",
        "bg-gradient-to-br from-accent to-[oklch(45%_0.13_145)]",
        hidden ? "scale-110 opacity-0 pointer-events-none" : "",
      )}
    >
      <div className="size-[72px] rounded-full bg-white/20 flex items-center justify-center mb-6 animate-pulse-ring">
        <Logo className="size-10 text-white" />
      </div>
      <div className="font-display text-[clamp(36px,10vw,56px)] font-bold tracking-[-0.03em] mb-2">
        La Verde
      </div>
      <div className="text-body opacity-80 mb-12">Encuentra tu lugar en Cuba</div>
      <div className="text-small opacity-60">Comenzando...</div>
    </div>
  );
}
