"use client";

import { motion } from "motion/react";
import { fadeUp, staggerContainer, VIEWPORT } from "./anim";

/* La `pill` es la categoría canónica de `BUSINESS_CATEGORIES`
   (src/lib/places.ts), en minúscula. Sirve para que el ejemplo enseñe de qué
   categoría habla la búsqueda. */
const EXAMPLES = [
  {
    query: "Donde comer rico con la jeva esta noche",
    pill: "restaurante",
    tags: ["esta noche", "con pareja"],
  },
  {
    query: "Donde puedo comprar el carne que acepten transferencia",
    pill: "mercado",
    tags: ["transferencia", "carne"],
  },
  {
    query: "Me apetece una hamburguesa con jamón cerca de mi",
    pill: "restaurante",
    tags: ["hamburguesa", "cerca de mi"],
  },
  {
    query: "Quiero tomarme un café en transferencia",
    pill: "cafeteria",
    tags: ["transferencia", "café"],
  },
];

function ExampleCard({
  query,
  pill,
  tags,
}: {
  query: string;
  pill: string;
  tags: string[];
}) {
  return (
    <motion.div
      variants={fadeUp}
      whileTap={{ scale: 0.98 }}
      className="flex flex-col gap-3.5 rounded-4xl border border-ink/5 bg-white p-7 shadow-soft transition-all duration-500 ease-outquint hover:-translate-y-1 hover:shadow-card"
    >
      <p className="text-[17px] font-medium leading-[1.5] text-ink text-pretty">
        <span className="font-lv-display text-[24px] text-verde-600/40" aria-hidden>
          &ldquo;
        </span>
        {query}
        <span className="font-lv-display text-[24px] text-verde-600/40" aria-hidden>
          &rdquo;
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {/* El sistema no usa monoespaciadas: la etiqueta va en la display. */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-verde-200 bg-verde-50 px-3 py-1 font-lv-display text-[10px] font-semibold uppercase tracking-[0.18em] text-verde-600">
          {pill}
        </span>
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full border border-ink/5 px-3 py-1 text-[13px] font-medium text-ink-soft/75"
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

export function SearchExamples() {
  return (
    <section
      id="ejemplos"
      className="border-t border-ink/5 bg-sand py-24 sm:py-32"
    >
      <div className="mx-auto max-w-container px-gutter md:px-gutter-lg">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          variants={staggerContainer(0.12)}
          className="mb-gap-2xl max-w-[48ch]"
        >
          <motion.p
            variants={fadeUp}
            className="inline-flex items-center rounded-full border border-verde-200 bg-verde-50 px-3.5 py-1.5 font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600"
          >
            Busquedas reales
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="mt-5 font-lv-display text-4xl font-bold tracking-[-0.02em] text-ink text-balance sm:text-5xl"
          >
            Asi habla Cuba con La Verde
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-6 text-lead text-ink-soft/75 text-pretty"
          >
            Ejemplos de como los usuarios encuentran lugares con lenguaje
            natural.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          variants={staggerContainer(0.08, 0.05)}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {EXAMPLES.map((ex) => (
            <ExampleCard
              key={ex.query}
              query={ex.query}
              pill={ex.pill}
              tags={ex.tags}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}