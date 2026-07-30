"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const PHRASES = [
  "Un cafe tranquilo cerca de mi que acepte MLC",
  "Restaurante con vista al mar para hoy",
  "Donde puedo comprar frutas baratas en Vedado",
  "Bar que toque son cubano esta noche",
  "Lugar con wifi para trabajar remoto",
];

function TypingAnimation() {
  const [displayed, setDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let phraseIdx = 0;
    let charIdx = 0;
    let isDeleting = false;
    let timeout: ReturnType<typeof setTimeout>;

    function step() {
      const current = PHRASES[phraseIdx];
      if (!isDeleting) {
        setDisplayed(current.substring(0, charIdx + 1));
        charIdx++;
        if (charIdx === current.length) {
          isDeleting = true;
          timeout = setTimeout(step, 2000);
          return;
        }
        timeout = setTimeout(step, 55 + Math.random() * 35);
      } else {
        setDisplayed(current.substring(0, charIdx - 1));
        charIdx--;
        if (charIdx === 0) {
          isDeleting = false;
          phraseIdx = (phraseIdx + 1) % PHRASES.length;
          timeout = setTimeout(step, 400);
          return;
        }
        timeout = setTimeout(step, 30);
      }
    }

    timeout = setTimeout(step, 400);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const blink = setInterval(() => {
      setShowCursor((v) => !v);
    }, 530);
    return () => clearInterval(blink);
  }, []);

  return (
    <span>
      {displayed}
      <span
        className={cn(
          "ml-[1px] text-accent",
          showCursor ? "opacity-100" : "opacity-0",
        )}
      >
        |
      </span>
    </span>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-[clamp(60px,12vw,140px)] pt-[clamp(60px,12vw,140px)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[5%] -top-[20%] size-[800px]"
      >
        <div className="size-full rounded-full bg-[radial-gradient(circle,oklch(62%_0.16_145/0.07)_0%,transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-container px-gutter md:px-gutter-lg">
        <div className="relative mx-auto max-w-[720px] text-center">
          <p className="animate-fade-up font-mono text-xs font-medium uppercase tracking-[0.1em] text-accent">
            Descubrimiento de lugares
          </p>

          <h1 className="animate-fade-up text-hero font-display font-bold text-foreground text-balance [animation-delay:100ms]">
            Escribe lo que buscas.
            <br />
            La Verde te lleva.
          </h1>

          <p className="mx-auto mt-gap-xl max-w-[52ch] animate-fade-up text-lead text-muted-foreground text-pretty [animation-delay:200ms]">
            Preguntale a La Verde como si hablaras con un amigo,
            y encuentra el lugar que buscas en Cuba.
          </p>

          <div className="mt-gap-xl flex animate-fade-up flex-wrap justify-center gap-gap-sm [animation-delay:300ms]">
            <Link
              href="/home"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lv bg-accent px-6 py-3 font-display text-[15px] font-semibold leading-none text-accent-foreground shadow-[0_1px_3px_oklch(62%_0.16_145/0.25)] transition-all duration-200 active:translate-y-px hover:bg-accent-hover hover:shadow-[0_4px_12px_oklch(62%_0.16_145/0.3)]"
            >
              Probar La Verde
            </Link>
            <Link
              href="#como-funciona"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lv border border-border bg-transparent px-6 py-3 font-display text-[15px] font-semibold leading-none text-foreground transition-all duration-200 active:translate-y-px hover:border-foreground"
            >
              Como funciona
            </Link>
          </div>

          <div className="mx-auto mt-gap-2xl flex max-w-[600px] animate-fade-up items-center gap-2 rounded-lv-lg border border-border bg-surface p-1.5 shadow-lv-md [animation-delay:300ms] md:flex-row md:p-1.5">
            <div className="ml-2 flex size-10 shrink-0 items-center justify-center text-accent">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M9.5 3.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <div className="flex-1 overflow-hidden py-2.5 text-left text-[16px] text-muted-foreground md:text-[16px]">
              <TypingAnimation />
            </div>
            <button className="shrink-0 rounded-lv bg-accent px-5 py-2.5 text-[14px] font-semibold text-accent-foreground transition-all active:translate-y-px hover:bg-accent-hover max-md:w-full max-md:text-center">
              Buscar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
