import type { Variants } from "motion/react";

// `easeOutQuint` del design system de La Verde. Es el mismo valor que ya había
// aquí, así que no cambia.
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// El sistema pide reveals lentos (0.9s) y un desenfoque que se disuelve. El
// desenfoque es lo que hace que la entrada se lea como "aparece" y no como
// "se desliza".
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease: EASE },
  },
};

/**
 * Margen de disparo del sistema: el elemento entra 80 px antes de asomarse y
 * no se repite. Se usa tal cual en cada `whileInView` de la landing.
 */
export const VIEWPORT = { once: true, margin: "-80px 0px -80px 0px" } as const;

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: 8 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 20 },
  },
};

export function staggerContainer(
  staggerChildren = 0.1,
  delayChildren = 0,
): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren, delayChildren } },
  };
}

export const heroContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};
