"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";
import { EASE, fadeUp, popIn, staggerContainer } from "./anim";

const FEATURES = [
  {
    title: "IA que entiende Cuba",
    description:
      "No es un chatbot generico. La Verde conoce barrios, monedas, horarios y costumbres cubanas para darte resultados reales.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
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
      "La Verde te recomienda segun tu ubicacion, la hora, el momento y lo que buscas. Como un amigo que conoce bien la ciudad.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m0-10.14l2.83 2.83m4.48 4.48l2.83 2.83" />
      </svg>
    ),
  },
  {
    title: "Rapido incluso sin datos",
    description:
      "Funciona con conexion lenta. Tiles ligeros, cache inteligente y skeleton states para que nunca veas una pantalla en blanco.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
];

const STATS = [
  {
    value: "3",
    label: "Tipos de moneda reconocidos",
    desc: "CUP, USD Clásica y USD. Paga como quieras.",
  },
  {
    value: "15+",
    label: "Categorias de lugares cubanos",
    desc: "De cafeteria a bodega, encuentra lo que buscas.",
  },
  {
    value: "~2s",
    label: "Tiempo promedio de busqueda",
    desc: "De la pregunta al resultado en conexion 3G.",
  },
];

function StatValue({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const numeric = /^\d+$/.test(value);
  const count = useMotionValue(0);
  const text = useTransform(count, (v) => Math.round(v).toString());

  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!inView || started) return;
    setStarted(true);
    if (!numeric) return;
    const controls = animate(count, Number(value), {
      duration: 1,
      ease: EASE,
    });
    return () => controls.stop();
  }, [inView, started, numeric, value, count]);

  return (
    <span
      ref={ref}
      className="font-mono font-variant-numeric-tabular"
    >
      {numeric ? <motion.span>{text}</motion.span> : value}
    </span>
  );
}

export function Features() {
  return (
    <>
      <section className="border-t border-border bg-surface py-[clamp(48px,8vw,120px)]">
        <div className="mx-auto max-w-container px-gutter md:px-gutter-lg">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer(0.15)}
            className="mx-auto mb-gap-3xl max-w-[42ch] text-center"
          >
            <motion.p
              variants={fadeUp}
              className="font-mono text-xs font-medium uppercase tracking-[0.1em] text-accent"
            >
              Por que La Verde
            </motion.p>
            <motion.h2
              variants={fadeUp}
              className="mt-gap-xs text-h2 font-display font-semibold text-foreground text-balance"
            >
              No es otro buscador de Google.
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer(0.1)}
            className="grid grid-cols-1 gap-gap-lg md:grid-cols-2 lg:grid-cols-3"
          >
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="transition-colors duration-300"
              >
                <motion.div
                  variants={popIn}
                  className="mb-gap-lg flex size-11 items-center justify-center rounded-lv bg-accent/12"
                >
                  <div className={cn("size-[22px] text-accent")}>{f.icon}</div>
                </motion.div>
                <h3 className="mb-2 font-display text-[20px] font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="text-[15px] leading-[1.6] text-muted-foreground text-pretty">
                  {f.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-[clamp(48px,8vw,120px)]">
        <div className="mx-auto max-w-container px-gutter md:px-gutter-lg">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer(0.12)}
            className="grid grid-cols-1 gap-gap-lg md:grid-cols-3"
          >
            {STATS.map((stat) => (
              <motion.div key={stat.label} variants={fadeUp}>
                <div className="font-display text-[clamp(48px,7vw,80px)] font-bold leading-[0.95] tracking-[-0.04em] text-accent">
                  <StatValue value={stat.value} />
                </div>
                <p className="mt-2.5 text-[15px] font-medium leading-[1.4] text-foreground">
                  {stat.label}
                </p>
                <p className="mt-1 text-[14px] leading-[1.5] text-muted-foreground">
                  {stat.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
}