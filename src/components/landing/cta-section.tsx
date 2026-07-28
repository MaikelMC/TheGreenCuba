"use client";

import Link from "next/link";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

export function CTASection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="border-t border-border bg-gradient-to-b from-background to-[oklch(95%_0.015_145)] py-[clamp(48px,8vw,96px)]">
      <div className="mx-auto max-w-[560px] px-gutter text-center md:px-gutter-lg">
        <div
          ref={ref}
          className={cn(
            "transition-all duration-[600ms] ease-out",
            isVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-6 opacity-0",
          )}
        >
          <h2 className="text-h2 font-display font-semibold text-foreground text-balance">
            Descubre Cuba como nunca.
          </h2>
          <p className="mx-auto mt-gap-md max-w-[52ch] text-lead text-muted-foreground text-pretty">
            Unete a la lista de espera y se de los primeros en probar La
            Verde cuando lancemos.
          </p>
          <div className="mt-gap-xl flex flex-wrap justify-center gap-gap-sm">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lv bg-accent px-6 py-3 font-display text-[15px] font-semibold leading-none text-accent-foreground shadow-[0_1px_3px_oklch(62%_0.16_145/0.25)] transition-all duration-200 active:translate-y-px hover:bg-accent-hover hover:shadow-[0_4px_12px_oklch(62%_0.16_145/0.3)]"
            >
              Unirse a la lista de espera
            </Link>
            <Link
              href="#como-funciona"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lv border border-border bg-transparent px-6 py-3 font-display text-[15px] font-semibold leading-none text-foreground transition-all duration-200 active:translate-y-px hover:border-foreground"
            >
              Saber mas
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
