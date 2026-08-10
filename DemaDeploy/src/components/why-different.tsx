"use client";

import { motion } from "framer-motion";
import { BadgeDollarSign, Database, Leaf, Lock, Scale, ShieldCheck, Sparkles, Sprout } from "lucide-react";
import Reveal from "@/components/ui/reveal";
import { cardIn } from "@/lib/motion";

const DIFFS = [
  {
    icon: ShieldCheck,
    title: "Curado, no acumulado",
    desc: "No cada pyme y cada hotel. Sí cada lugar que el equipo verificó en persona. Menos, pero mejor."
  },
  {
    icon: Lock,
    title: "Precios en USD, reales",
    desc: "Adiós al misterio de la doble moneda. Sabés cuánto vas a gastar antes de salir de casa."
  },
  {
    icon: Database,
    title: "Salud verde, un puntaje vivo",
    desc: "El rating La Verde no se compra: se merece en la calle, se sostiene con actualizaciones del equipo local."
  },
  {
    icon: Sparkles,
    title: "IA en el idioma del lugar",
    desc: "No buscás por keywords: le contás qué sentís y La Verde conecta con el rincón que buscabas."
  }
];

export default function WhyDifferent() {
  return (
    <section id="diferente" className="relative overflow-hidden bg-sand py-24 sm:py-32">
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-verde-100/70 blur-3xl" />
      <div className="container relative z-10">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="lg:sticky lg:top-28">
            <Reveal>
              <span className="eyebrow border border-verde-200 bg-verde-50 text-verde-600">
                <Sprout className="h-3 w-3" strokeWidth={2} />
                Por qué La Verde
              </span>
              <h2 className="mt-5 font-display text-balance text-4xl font-bold leading-tight tracking-[-0.02em] text-ink sm:text-5xl">
                Los mapas de Cuba{" "}
                <span className="text-verde-600">miden el tráfico.</span>
                <br />
                La Verde{" "}
                <span className="bg-gradient-to-r from-verde-500 to-verde-700 bg-clip-text text-transparent">
                  mide la esencia.
                </span>
              </h2>
              <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-ink-soft/80">
                La diferencia no está en la tecnología —está en el criterio. Curamos,
                geolocalizamos y mantenemos cada rincón con un equipo que camina la isla.
              </p>
              <div className="mt-8 flex items-center gap-3 rounded-3xl border border-verde-200/60 bg-verde-50/60 p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-verde-400/15 text-verde-700">
                  <BadgeDollarSign className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <p className="text-sm text-ink-soft/80">
                  <span className="font-semibold text-ink">Precio claro en USD</span> en
                  cada ficha. Comprar no paga ranking; solo la calidad sostiene la salud
                  verde.
                </p>
              </div>
            </Reveal>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {DIFFS.map((d, i) => (
              <Reveal key={d.title} delay={i * 0.08}>
                <motion.article
                  variants={cardIn}
                  className="group relative h-full overflow-hidden rounded-4xl border border-ink/5 bg-white p-7 shadow-soft transition-all duration-500 hover:-translate-y-1 hover:shadow-card"
                >
                  <div className="flex items-start gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-verde-50 text-verde-700 transition-colors duration-300 group-hover:bg-verde-100">
                      <d.icon className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold text-ink">{d.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft/75">
                        {d.desc}
                      </p>
                    </div>
                  </div>
                </motion.article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}