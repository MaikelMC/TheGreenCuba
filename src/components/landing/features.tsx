"use client";

import { motion } from "motion/react";
import { fadeUp, popIn, staggerContainer, VIEWPORT } from "./anim";

const FEATURES = [
  {
    title: "IA que entiende Cuba",
    description:
      "No es un chatbot genérico. La Verde conoce barrios, monedas, horarios y costumbres cubanas para darte resultados reales.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3c-4.97 0-9 3.58-9 8s4.03 8 9 8c.71 0 1.4-.08 2.06-.22L19 21l-.78-3.46C20.04 16.21 21 14.21 21 12c0-4.42-4.03-8-9-8z" />
        <path d="M10 9.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5.67-1.5 1.5" />
      </svg>
    ),
  },
  {
    title: "Recomendaciones contextualizadas",
    description:
      "La Verde te recomienda según tu ubicación, la hora, el momento y lo que buscas. Como un amigo que conoce bien la ciudad.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m0-10.14l2.83 2.83m4.48 4.48l2.83 2.83" />
      </svg>
    ),
  },
  {
    title: "Rápido incluso sin datos",
    description:
      "Funciona con conexión lenta. Usa mapas ligeros, caché inteligente y estados de carga para que nunca veas una pantalla en blanco.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section className="border-t border-ink/5 bg-sand py-24 sm:py-32">
        <div className="mx-auto max-w-container px-gutter md:px-gutter-lg">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            variants={staggerContainer(0.12)}
            className="mx-auto mb-gap-3xl max-w-[42ch] text-center"
          >
            <motion.p
              variants={fadeUp}
              className="landing-features-label inline-flex items-center rounded-full border border-verde-200 bg-verde-50 px-3.5 py-1.5 font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600"
            >
              Por qué La Verde
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="mt-5 font-lv-display text-4xl font-bold tracking-[-0.02em] text-ink text-balance sm:text-5xl"
            >
              No es otro buscador de Google.
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT}
            variants={staggerContainer(0.1)}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                whileTap={{ scale: 0.98 }}
                className="group rounded-4xl border border-ink/5 bg-white p-7 shadow-soft transition-all duration-500 ease-outquint hover:-translate-y-1 hover:shadow-card"
              >
                <motion.div
                  variants={popIn}
                  className="landing-feature-icon mb-gap-lg flex size-11 items-center justify-center rounded-2xl bg-verde-50 text-verde-700 transition-colors duration-500 group-hover:bg-verde-100"
                >
                  <div className="size-[22px]">{f.icon}</div>
                </motion.div>
                <h3 className="mb-2 font-lv-display text-lg font-bold text-ink">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-ink-soft/75 text-pretty">
                  {f.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
    </section>
  );
}