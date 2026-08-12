"use client";

import { BellRing, Bot, Megaphone, Sparkles } from "lucide-react";
import { useState } from "react";
import Reveal from "@/components/ui/reveal";
import WaitlistForm from "@/components/waitlist-form";

type Tipo = "usuario" | "negocio";

export default function Waitlist() {
  const [tipo, setTipo] = useState<Tipo>("usuario");

  return (
    <section id="waitlist" className="relative overflow-hidden bg-verde-950 py-24 text-white sm:py-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-10 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-verde-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-verde-600/20 blur-3xl" />
      </div>

      <div className="container relative z-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow border border-verde-400/30 bg-verde-400/10 text-verde-200 backdrop-blur-sm">
            <BellRing className="h-3 w-3" strokeWidth={2} />
            Acceso anticipado · solo una tanda
          </span>
          <h2 className="mt-6 font-display text-balance text-4xl font-bold leading-tight tracking-[-0.02em] sm:text-5xl">
            Cuba se está moviendo.{" "}
            <span className="bg-gradient-to-r from-verde-200 to-emerald-400 bg-clip-text text-transparent">
              Sé de los primeros.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-pretty text-base leading-relaxed text-white/65">
            El lanzamiento en Cuba está abierto y sin límite de cupos. Súmate a la
            lista y entra antes que el mapa público.
          </p>
        </Reveal>

        <Reveal delay={0.15} className="mt-12">
          <WaitlistForm tipo={tipo} onTipoChange={setTipo} />
        </Reveal>

        <Reveal delay={0.25} className="mx-auto mt-10 max-w-md">
          <div className="relative overflow-hidden rounded-3xl border border-verde-400/25 bg-white/5 p-6 text-center backdrop-blur-sm">
            <div className="pointer-events-none absolute -top-10 left-1/2 h-28 w-72 -translate-x-1/2 rounded-full bg-verde-400/25 blur-3xl" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-verde-400/30 bg-verde-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-verde-200">
              <Sparkles className="h-3 w-3" strokeWidth={2} />
              Para los primeros negocios
            </span>
            <h3 className="mt-4 font-display text-2xl font-bold leading-tight tracking-[-0.01em]">
              Primeros{" "}
              <span className="bg-gradient-to-r from-verde-200 to-emerald-400 bg-clip-text text-transparent">
                15 días gratis
              </span>{" "}
              en la plataforma
            </h3>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/70">
              Los primeros negocios que entren corren con alta visibilidad y
              recomendación de IA frente a los usuarios que buscan dónde ir.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 text-left">
              <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                <Megaphone className="h-4 w-4 text-verde-300" strokeWidth={2} />
                <p className="mt-2 text-[13px] font-semibold text-white">
                  Alta visibilidad
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-white/50">
                  Destacado frente a los usuarios
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                <Bot className="h-4 w-4 text-verde-300" strokeWidth={2} />
                <p className="mt-2 text-[13px] font-semibold text-white">
                  Recomendación IA
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-white/50">
                  La IA lo sugiere a quien pregunta
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}