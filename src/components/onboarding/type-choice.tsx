"use client";

import { ArrowRight, Compass, Store } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * La pantalla que bifurca el onboarding.
 *
 * No es un paso: no avanza en la barra de progreso, no se cuenta en el total y
 * no se vuelve a ella. Una vez elegido el camino, cada uno sigue por su cuenta.
 *
 * Dos tarjetas con la forma de `business-entry.tsx` —icono, titular, una línea
 * de qué es y otra de qué hace—: la clara es el camino de siempre y la verde es
 * el alta de negocio, que es la que trae a alguien nuevo a la app.
 */
interface TypeChoiceProps {
  onChoose: (path: "user" | "business") => void;
}

const CARD =
  "group flex min-h-[176px] w-full flex-col justify-between gap-gap-md rounded-[24px] p-gap-lg text-left transition-all duration-500 ease-outquint active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400 focus-visible:ring-offset-2";

export function TypeChoice({ onChoose }: TypeChoiceProps) {
  return (
    <div className="flex flex-col gap-gap-md">
      <header className="mb-gap-xs">
        <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">
          Antes de empezar
        </p>
        <h1 className="mt-gap-xs font-lv-display text-h2 font-bold leading-tight tracking-[-0.02em] text-ink">
          ¿Cómo vas a usar La Verde?
        </h1>
        <p className="mt-gap-sm text-body leading-relaxed text-ink-soft/75">
          Elige una. Se puede cambiar después desde tu perfil.
        </p>
      </header>

      <button
        type="button"
        onClick={() => onChoose("user")}
        className={cn(
          CARD,
          "border border-ink/10 bg-white shadow-soft hover:border-verde-300 hover:bg-verde-50/40",
        )}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-verde-50 text-verde-700">
          <Compass size={24} strokeWidth={1.8} />
        </span>
        <span className="flex flex-col gap-gap-xs">
          <span className="font-lv-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Solo quiero explorar
          </span>
          <span className="text-small leading-relaxed text-ink-soft/75">
            Busca y guarda lugares cerca de ti.
          </span>
        </span>
        <span className="flex items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-700">
          Empezar
          <ArrowRight
            size={17}
            strokeWidth={1.8}
            className="transition-transform duration-500 group-hover:translate-x-1"
          />
        </span>
      </button>

      <button
        type="button"
        onClick={() => onChoose("business")}
        className={cn(
          CARD,
          "border border-verde-500/25 bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300",
        )}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-white/40 text-verde-950">
          <Store size={24} strokeWidth={1.8} />
        </span>
        <span className="flex flex-col gap-gap-xs">
          <span className="font-lv-display text-[22px] font-bold leading-tight tracking-[-0.02em]">
            Tengo un negocio
          </span>
          <span className="text-small leading-relaxed text-verde-950/75">
            Publica tu local en el mapa y gestiónalo desde aquí.
          </span>
        </span>
        <span className="flex items-center gap-gap-xs font-lv-display text-small font-semibold">
          Publicar mi negocio
          <ArrowRight
            size={17}
            strokeWidth={1.8}
            className="transition-transform duration-500 group-hover:translate-x-1"
          />
        </span>
      </button>
    </div>
  );
}
