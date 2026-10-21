import Link from "next/link";
import { ArrowRight, MapPin, Play, Search, Sparkles } from "lucide-react";
import { Reveal } from "./reveal";
import { ViewMapLink } from "./view-map-link";

function BrowserMockup() {
  return (
    <div className="relative mx-auto mt-14 w-full max-w-5xl sm:mt-20">
      <div className="relative h-[340px] overflow-hidden rounded-t-[24px] border border-b-0 border-ink/10 bg-white shadow-card sm:h-[420px]">
        <div className="flex h-10 items-center gap-3 border-b border-ink/10 bg-sand-warm px-4">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-ink/15" />
            <span className="size-2.5 rounded-full bg-ink/15" />
            <span className="size-2.5 rounded-full bg-ink/15" />
          </span>
          <span className="lv-mono mx-auto truncate rounded-full border border-ink/10 bg-white px-4 py-1 text-[10px] uppercase tracking-[0.14em] text-ink-soft/65">
            laverde.kynari.dev/mapa
          </span>
          <span className="w-11" aria-hidden />
        </div>

        <div className="lv-mini-map relative h-full">
          <svg
            aria-hidden
            viewBox="0 0 800 420"
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
          >
            <g
              className="lv-map-streets"
              fill="none"
              stroke="rgba(8,19,13,0.12)"
              strokeWidth="2"
            >
              <path d="M-20 110C150 110 210 72 380 72s260 54 440 54" />
              <path d="M120 -20c0 140 40 190 40 300s-50 110-50 160" />
              <path d="M560 -20c0 110-60 170-60 260s70 110 70 200" />
            </g>
            <g className="lv-map-blocks" fill="rgba(8,19,13,0.05)">
              <rect x="70" y="140" width="120" height="70" rx="8" />
              <rect x="230" y="210" width="90" height="110" rx="8" />
              <rect x="620" y="170" width="120" height="90" rx="8" />
              <rect x="340" y="40" width="80" height="60" rx="8" />
            </g>
            <g fill="none" stroke="#35af6d" strokeWidth="3" strokeLinecap="round">
              <path d="M390 330c60-40 90-80 90-130" strokeDasharray="6 8" />
            </g>
          </svg>

          <div className="absolute left-[38%] top-[46%] -translate-x-1/2 -translate-y-full">
            <span className="relative grid size-10 place-items-center rounded-full bg-verde-500 text-white shadow-primary-halo">
              <MapPin size={19} strokeWidth={2} aria-hidden />
              <span className="absolute inset-0 -z-10 animate-pulse-ring rounded-full bg-verde-400/40 motion-reduce:animate-none" />
            </span>
          </div>
          <div className="absolute left-[68%] top-[34%] size-7 rounded-full border-2 border-white bg-verde-300 shadow-soft" />
          <div className="absolute left-[22%] top-[66%] size-6 rounded-full border-2 border-white bg-verde-200 shadow-soft" />

          <div className="absolute inset-x-4 top-5 mx-auto flex max-w-[440px] items-center gap-3 rounded-full border border-ink/10 bg-white/95 px-4 py-2.5 shadow-card backdrop-blur">
            <Search size={17} className="shrink-0 text-ink-soft/65" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm text-ink-soft/80">
              ¿dónde comer tacos?
            </span>
            <Sparkles size={15} className="shrink-0 text-verde-500" aria-hidden />
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-white">
              <ArrowRight size={14} aria-hidden />
            </span>
          </div>

          <div className="absolute bottom-6 left-4 hidden items-center gap-2 rounded-2xl border border-ink/10 bg-white/95 px-3 py-2 shadow-soft backdrop-blur sm:flex">
            <span className="size-1.5 rounded-full bg-verde-500" aria-hidden />
            <span className="text-xs font-medium text-ink-soft/75">
              3 lugares cerca de ti
            </span>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#fbf9f4] to-transparent dark:from-[#08130d]"
      />
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-36">
      <div className="mx-auto w-full max-w-container px-gutter md:px-gutter-lg">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3.5 py-1.5 text-xs font-medium text-ink-soft shadow-lv-xs">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-verde-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-verde-600" />
            </span>
            Nuevo · Menú QR y asistente por Telegram
          </span>

          <Reveal
            as="h1"
            text="Tu negocio, justo en la verde."
            accent="la verde"
            className="mx-auto mt-6 max-w-[15ch] font-lv-display text-[clamp(44px,8vw,86px)] font-bold leading-[0.96] tracking-[-0.04em] text-ink text-balance"
          />

          <Reveal
            as="p"
            text="Tu negocio en el mapa, tu menú en un QR y tu asistente en Telegram."
            delay={240}
            className="mx-auto mt-6 max-w-[46ch] text-base leading-relaxed text-ink-soft/75 text-pretty sm:text-lg"
          />

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="landing-cta-solid inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 font-lv-display text-sm font-semibold leading-none text-white transition duration-300 ease-outquint hover:bg-ink-soft active:scale-[0.98] sm:w-auto"
            >
              Agregar mi negocio
              <ArrowRight size={16} aria-hidden />
            </Link>
            <ViewMapLink className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-white/70 px-6 py-3.5 font-lv-display text-sm font-semibold leading-none text-ink transition duration-300 ease-outquint hover:border-ink/30 hover:bg-white active:scale-[0.98] sm:w-auto">
              <Play size={12} fill="currentColor" aria-hidden />
              Ver el mapa
            </ViewMapLink>
          </div>
        </div>

        <BrowserMockup />
      </div>
    </section>
  );
}
