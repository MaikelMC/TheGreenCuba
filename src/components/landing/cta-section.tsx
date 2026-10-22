import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { Reveal } from "./reveal";
import { ViewMapLink } from "./view-map-link";

export function CTASection() {
  return (
    <section className="pb-20 pt-4 sm:pb-28">
      <div className="mx-auto w-full max-w-container px-gutter md:px-gutter-lg">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-16 text-center sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_10%,rgba(53,175,109,0.35),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(15,122,65,0.35),transparent_45%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:20px_20px]"
          />

          <div className="lv-accent-on-dark relative mx-auto max-w-3xl">
            <p className="lv-mono text-[11px] uppercase tracking-[0.2em] text-verde-300">
              Empieza
            </p>
            <Reveal
              as="h2"
              text="¿Listo para estar en la verde?"
              accent="la verde"
              className="mt-4 font-lv-display text-[clamp(34px,5.5vw,60px)] font-bold leading-[1.02] tracking-[-0.04em] text-white text-balance"
            />
            <Reveal
              as="p"
              text="Crea tu ficha, publica tu menú y aparece donde la gente busca."
              delay={120}
              className="mx-auto mt-5 max-w-[48ch] text-base leading-relaxed text-white/65 text-pretty"
            />

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-verde-400 px-6 py-3.5 text-sm font-semibold leading-none text-verde-950 transition duration-300 ease-outquint hover:bg-verde-300 active:scale-[0.98] sm:w-auto"
              >
                Agregar mi negocio
                <ArrowRight size={16} aria-hidden />
              </Link>
              <ViewMapLink className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold leading-none text-white transition duration-300 ease-outquint hover:border-white/40 hover:bg-white/10 active:scale-[0.98] sm:w-auto">
                <Play size={12} fill="currentColor" aria-hidden />
                Ver el mapa
              </ViewMapLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
