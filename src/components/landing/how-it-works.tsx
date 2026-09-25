"use client";

import { motion } from "motion/react";
import { fadeUp, popIn, staggerContainer, VIEWPORT } from "./anim";

const STEPS = [
  {
    title: "Escribe lo que quieres",
    description:
      "No necesitas elegir categorías ni llenar filtros. Simplemente describe lo que buscas como lo harías con un amigo: \"un café tranquilo cerca de mí que acepte USD Clásica\".",
  },
  {
    title: "La Verde interpreta",
    description:
      "La app entiende el contexto cubano: monedas, barrios, horarios y costumbres. No es un buscador genérico: entiende lo que necesitas.",
  },
  {
    title: "Encuentra tu lugar",
    description:
      "Encuentra resultados en el mapa con la dirección exacta, recomendaciones personalizadas y toda la información que necesitas para llegar.",
  },
];

function StepCard({
  index,
  title,
  description,
}: {
  index: number;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="grid grid-cols-1 items-start gap-gap-md rounded-4xl border border-ink/5 bg-white p-7 shadow-soft transition-all duration-500 ease-outquint hover:-translate-y-1 hover:shadow-card md:block"
    >
      <motion.div
        variants={popIn}
        className="relative mb-gap-md font-lv-display text-[clamp(48px,6vw,72px)] font-bold leading-none tracking-[-0.04em] md:mb-gap-md"
      >
        <span className="landing-step-number-back text-verde-600/10" aria-hidden>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="landing-step-number-front absolute inset-0 text-verde-600/20" aria-hidden>
          {String(index + 1).padStart(2, "0")}
        </span>
      </motion.div>
      <div>
        <h3 className="mb-2 font-lv-display text-lg font-bold text-ink">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-ink-soft/75 text-pretty">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="border-t border-ink/5 bg-sand py-24 sm:py-32"
    >
      <div className="mx-auto max-w-container px-gutter md:px-gutter-lg">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          variants={staggerContainer(0.12)}
          className="mx-auto mb-gap-3xl max-w-[48ch] text-center"
        >
          <motion.p
            variants={fadeUp}
            className="landing-how-it-works-label inline-flex items-center rounded-full border border-verde-200 bg-verde-50 px-3.5 py-1.5 font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600"
          >
            Cómo funciona
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="mt-5 font-lv-display text-4xl font-bold tracking-[-0.02em] text-ink text-balance sm:text-5xl"
          >
            Tres pasos. Sin registros complicados.
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          variants={staggerContainer(0.12)}
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {STEPS.map((step, i) => (
            <StepCard
              key={step.title}
              index={i}
              title={step.title}
              description={step.description}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
