"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { fadeUp, heroContainer } from "./anim";

const PHRASES = [
  "Un café tranquilo cerca de mí que acepte USD Clásica",
  "Restaurante con vista al mar para hoy",
  "¿Dónde puedo comprar frutas baratas en Vedado?",
  "¿Dónde encuentro un bar con son cubano esta noche?",
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
      const current = PHRASES[phraseIdx] ?? "";
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
          "ml-[1px] text-verde-300",
          showCursor ? "opacity-100" : "opacity-0",
        )}
      >
        |
      </span>
    </span>
  );
}

/**
 * Provincias del marquee. Es decorativo — el sistema pide que los nombres
 * propios vayan aquí y no en el titular. Las 15 provincias más la Isla de la
 * Juventud, que es municipio especial y no provincia.
 */
const ZONES = [
  "Pinar del Río",
  "Artemisa",
  "La Habana",
  "Mayabeque",
  "Matanzas",
  "Cienfuegos",
  "Villa Clara",
  "Sancti Spíritus",
  "Ciego de Ávila",
  "Camagüey",
  "Las Tunas",
  "Granma",
  "Holguín",
  "Santiago de Cuba",
  "Guantánamo",
  "Isla de la Juventud",
];

function ZonesMarquee() {
  return (
    <div
      aria-hidden
      className="relative flex overflow-hidden border-t border-white/10 py-5 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
    >
      {/* El carril lleva la lista duplicada: `animate-marquee` desplaza -50%,
          que es exactamente una copia, así que el bucle no tiene costura. */}
      <div className="flex w-max shrink-0 animate-marquee gap-10 motion-reduce:animate-none">
        {[...ZONES, ...ZONES].map((zone, i) => (
          <span
            key={i}
            className="whitespace-nowrap font-lv-display text-[13px] uppercase tracking-[0.22em] text-white/35"
          >
            {zone}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    // `lv-grid-glow` es el cielo del sistema: dos radiales verdes sobre un
    // degradado casi negro. Único fondo oscuro de la landing junto al footer.
    <section className="landing-hero lv-grid-glow relative flex min-h-[100dvh] flex-col overflow-hidden pt-28">
      <div className="flex flex-1 items-center pb-16">
        <div className="mx-auto w-full max-w-container px-gutter md:px-gutter-lg">
          <motion.div
            initial="hidden"
            animate="show"
            variants={heroContainer}
            className="relative mx-auto max-w-[720px] text-center"
          >
            <motion.p
              variants={fadeUp}
              className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-200 backdrop-blur-sm"
            >
              Descubrimiento de lugares
            </motion.p>

            <motion.h1
              variants={fadeUp}
              className="mt-5 text-hero font-lv-display font-bold text-white text-balance"
            >
              Escribe lo que buscas.
              <br />
              {/* Degradado de marca: una sola frase por sección. */}
              <span className="bg-gradient-to-r from-verde-200 via-verde-300 to-emerald-400 bg-clip-text text-transparent">
                La Verde te lleva.
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mx-auto mt-gap-xl max-w-[52ch] text-lead text-white/70 text-pretty"
            >
              Pregúntale a La Verde como si hablaras con un amigo y encuentra
              el lugar que buscas en Cuba.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-gap-xl flex flex-wrap justify-center gap-gap-sm"
            >
              {/* La puerta de entrada para una persona nueva es el registro:
                  después de crear la cuenta continúa con sus preferencias. */}
              <Link
                href="/register"
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-verde-400 px-6 py-3 font-lv-display text-sm font-semibold leading-none text-verde-950 shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
              >
                Probar La Verde
              </Link>
              <Link
                href="#como-funciona"
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-6 py-3 font-lv-display text-sm font-semibold leading-none text-white transition-all duration-500 ease-outquint hover:bg-white/10 active:scale-[0.98]"
              >
                Cómo funciona
              </Link>
            </motion.div>

            {/* Pastilla solo a partir de `md`. Apilado, `rounded-full` muerde
                52px por esquina y el botón de dentro, con radio 20px, se sale
                de esa curva. En móvil va `rounded-4xl`, que respeta la caja. */}
            <motion.div
              variants={fadeUp}
              className="mx-auto mt-gap-2xl flex w-full max-w-[600px] flex-col gap-2 rounded-4xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-sm md:flex-row md:items-center md:rounded-full"
            >
              <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2">
                <div className="ml-2 flex size-10 shrink-0 items-center justify-center text-verde-300">
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
                <div className="min-w-0 flex-1 truncate py-2 text-left text-[16px] text-white/50">
                  <TypingAnimation />
                </div>
              </div>
              {/* `min-h-11` iguala el botón con la fila del input: antes medía
                  40px contra 45px y en móvil se notaba el desnivel. */}
              <button className="min-h-11 shrink-0 rounded-full bg-verde-400 px-5 text-sm font-semibold text-verde-950 transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] max-md:w-full max-md:text-center">
                Buscar
              </button>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <ZonesMarquee />
    </section>
  );
}
