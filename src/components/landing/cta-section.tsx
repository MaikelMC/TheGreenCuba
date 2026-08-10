"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { fadeUp, staggerContainer } from "./anim";
import { JoinButton } from "@/components/landing/join-button";

export function CTASection() {
  return (
    <section className="border-t border-border bg-gradient-to-b from-background to-[oklch(95%_0.015_145)] py-[clamp(48px,8vw,120px)]">
      <div className="mx-auto max-w-[640px] px-gutter text-center md:px-gutter-lg">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer(0.15)}
        >
          <motion.h2
            variants={fadeUp}
            className="text-h2 font-display font-semibold text-foreground text-balance"
          >
            Cuba como nunca la habias visto.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-gap-md max-w-[52ch] text-lead text-muted-foreground text-pretty"
          >
            Unete a la lista de espera y se de los primeros en probar La
            Verde cuando lancemos.
          </motion.p>
          <motion.div
            variants={fadeUp}
            className="mt-gap-xl flex flex-wrap justify-center gap-gap-sm"
          >
            <JoinButton className="px-6 py-3 text-[15px]" />
            <Link
              href="#como-funciona"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lv border border-border bg-transparent px-6 py-3 font-display text-[15px] font-semibold leading-none text-foreground transition-all duration-200 active:translate-y-px hover:border-foreground"
            >
              Saber mas
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}