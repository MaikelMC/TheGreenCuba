"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Tag = "h1" | "h2" | "h3" | "p" | "span" | "div";

interface RevealProps {
  text: string;
  /** Palabra o frase que va en verde y con subrayado suave. */
  accent?: string;
  as?: Tag;
  className?: string;
  /** Retardo base en ms. Las palabras suman 60 ms cada una. */
  delay?: number;
}

/**
 * Separa el texto por palabras y las revela una vez al entrar en pantalla.
 *
 * La animación vive en CSS (`globals.css`) para no traer JavaScript de
 * animación: aquí solo se observa el bloque y se marca `data-shown`. El bloque
 * nace visible; el JS lo arma (lo oculta) únicamente si arranca fuera de
 * pantalla, así el primer viewport no espera al observer ni al LCP. Con
 * `prefers-reduced-motion` no se arma nada.
 */
export function Reveal({
  text,
  accent,
  as: Tag = "div",
  className,
  delay = 0,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    /* Lo que ya se ve en el primer viewport no se arma: se queda pintado desde
       el HTML y no retrasa el LCP. Lo de más abajo sí se oculta y se revela al
       acercarse. */
    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;

    if (reduced || inView || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    setArmed(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const words = text.split(/\s+/).filter(Boolean);
  const accentWords = accent ? accent.toLowerCase().split(/\s+/) : [];

  function isAccent(index: number) {
    if (accentWords.length === 0) return false;
    return accentWords.every(
      (word, offset) =>
        words[index + offset]?.toLowerCase().replace(/[.,;:!?]/g, "") ===
        word.replace(/[.,;:!?]/g, ""),
    );
  }

  const accentSet = new Set<number>();
  if (accentWords.length > 0) {
    words.forEach((_, index) => {
      if (isAccent(index)) {
        for (let offset = 0; offset < accentWords.length; offset++) {
          accentSet.add(index + offset);
        }
      }
    });
  }

  return (
    <Tag
      ref={ref as never}
      data-armed={armed}
      data-shown={shown}
      className={cn("lv-reveal", className)}
    >
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span
            className={cn(
              "lv-reveal-word",
              accentSet.has(index) && "lv-accent-word",
            )}
            style={{ transitionDelay: `${delay + index * 60}ms` }}
          >
            {word}
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </Tag>
  );
}
