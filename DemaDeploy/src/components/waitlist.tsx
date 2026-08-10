"use client";

import { BellRing } from "lucide-react";
import Reveal from "@/components/ui/reveal";
import Counter from "@/components/ui/counter";
import WaitlistForm from "@/components/waitlist-form";

export default function Waitlist() {
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
            El lanzamiento en Cuba abre con cupo limitado. Súmate a la lista y entra
            antes que el mapa público.
          </p>
        </Reveal>

        <Reveal delay={0.15} className="mt-12">
          <WaitlistForm />
        </Reveal>

        <Reveal delay={0.25} className="mx-auto mt-10 max-w-md text-center">
          <div className="flex items-center justify-center gap-3 text-3xl font-display font-bold">
            <Counter
              to={1240}
              duration={2.2}
              format={(n) => `${n}`}
              className="text-verde-200"
            />
            <span className="text-white/40">/</span>
            <span className="text-white">2000</span>
          </div>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/40">
            cupos reservados
          </p>
          <div className="mx-auto mt-4 h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-verde-500 to-verde-300"
              style={{ width: "62%" }}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}