"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { fadeUp, staggerContainer, VIEWPORT } from "./anim";
import { LoginButton } from "@/components/landing/login-button";

export function CTASection() {
  return (
    <section className="landing-cta bg-sand-deep py-24 sm:py-32">
      <div className="mx-auto max-w-[640px] px-gutter text-center md:px-gutter-lg">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT}
          variants={staggerContainer(0.12)}
        >
          <motion.h2
            variants={fadeUp}
            className="font-lv-display text-4xl font-bold tracking-[-0.02em] text-ink text-balance sm:text-5xl"
          >
            Deja de adivinar dónde ir.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-[52ch] text-lead text-ink-soft/75 text-pretty"
          >
            La Verde entiende cómo hablas y te lleva al lugar correcto: con las
            monedas que aceptan, abierto a la hora que buscas y cerca de donde
            estás.
          </motion.p>
          <motion.div
            variants={fadeUp}
            className="mt-9 flex flex-wrap justify-center gap-gap-sm"
          >
            <LoginButton />
            <Link
              href="#como-funciona"
              className="landing-cta-secondary inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-ink/10 bg-white px-6 py-3 font-lv-display text-sm font-semibold leading-none text-ink transition-all duration-500 ease-outquint hover:bg-verde-50 active:scale-[0.98]"
            >
              Saber más
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}