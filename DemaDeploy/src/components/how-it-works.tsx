"use client";

import { motion } from "framer-motion";
import { HandCoins, HeartHandshake, Leaf, MapPinned, MessageCircleQuestion, Wheat } from "lucide-react";
import Reveal from "@/components/ui/reveal";
import { cardIn } from "@/lib/motion";

const STEPS = [
  {
    icon: MapPinned,
    title: "El lugar que buscas",
    desc: "Restaurantes, tiendas, bares, playas, rincones para compartir. Cada uno vive en el mapa con su dato real: precio, horario y ambiente."
  },
  {
    icon: MessageCircleQuestion,
    title: "Pregúntale a La Verde",
    desc: "Cuéntale con tus palabras qué necesitas. La IA entiende el contexto cubano y te dice qué tienes cerca de ti."
  },
  {
    icon: HeartHandshake,
    title: "Te damos la verde",
    desc: "En Cuba, cuando alguien te indica el lugar correcto, te da la verde. Eso hacemos: señalarte lo que de verdad necesitas, sin rodeos."
  }
];

export default function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-sand-warm py-24 sm:py-32">
      <div className="container">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow border border-verde-200 bg-verde-50 text-verde-600">
            Así funciona
          </span>
          <h2 className="mt-5 font-display text-balance text-4xl font-bold tracking-[-0.02em] text-ink sm:text-5xl">
            Tres pasos,{" "}
            <span className="text-verde-600">sin dar vueltas</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.12}>
              <motion.article
                variants={cardIn}
                className="group relative h-full overflow-hidden rounded-4xl border border-ink/5 bg-white p-8 shadow-card transition-all duration-500 hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-verde-100/70 blur-xl" />
                <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-verde-100 text-verde-700 transition-transform duration-500 group-hover:scale-105">
                  <step.icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <div className="relative mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-verde-500">
                  <span className="font-display text-xl text-verde-300">0{i + 1}</span>
                  Paso {i + 1}
                </div>
                <h3 className="relative mt-2 font-display text-xl font-bold text-ink">
                  {step.title}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-ink-soft/75">
                  {step.desc}
                </p>
              </motion.article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}