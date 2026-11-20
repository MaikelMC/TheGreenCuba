"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";

interface WelcomeSplashProps {
  /** `true` cuando ya se sabe si toca onboarding (la sesión respondió). */
  ready: boolean;
  onComplete: () => void;
}

/* Tiempo mínimo en pantalla, para que no sea un parpadeo con red rápida. */
const MIN_VISIBLE_MS = 900;
const FADE_MS = 300;

/**
 * El splash tapa la carga real de la sesión en vez de sumarse a ella. Antes la
 * página pintaba arena vacía mientras esperaba `fetchMe` y después el splash
 * corría 2,3 s fijos con los datos ya en la mano: espera doble. Ahora se monta
 * en el primer render y se va en cuanto la sesión responde y pasó el mínimo.
 */
export function WelcomeSplash({ ready, onComplete }: WelcomeSplashProps) {
  const [minDone, setMinDone] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinDone(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || !minDone) return;
    setHidden(true);
    const timer = setTimeout(onComplete, FADE_MS);
    return () => clearTimeout(timer);
  }, [ready, minDone, onComplete]);

  return (
    // `lv-grid-glow` es el cielo del hero de la landing: el único fondo oscuro
    // del sistema. `lv-grain` le quita el aspecto plano al degradado.
    <div
      className={cn(
        "lv-grid-glow lv-grain absolute inset-0 z-20 flex flex-col items-center justify-center text-center text-white transition duration-300 ease-outquint motion-reduce:transform-none",
        hidden ? "scale-105 opacity-0 pointer-events-none" : "",
      )}
    >
      <Logo className="h-[72px] w-auto mb-6 animate-pulse-ring motion-reduce:animate-none" />
      <div className="font-lv-display text-[clamp(36px,10vw,56px)] font-bold tracking-[-0.03em] mb-2">
        <span translate="no">La Verde</span>
      </div>
      <div className="text-lead text-white/70 mb-12">
        Encuentra tu lugar en Cuba
      </div>
      <div role="status" className="text-small text-white/60">
        Comenzando…
      </div>
    </div>
  );
}
