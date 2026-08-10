import type { Variants, Transition } from "framer-motion";

// Curva personalizada premium (sin ease-in/out genérico)
export const easeOutQuint: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const easeSpring: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const motionTransition = (delay = 0, duration = 0.9): Transition => ({
  type: "tween",
  ease: easeOutQuint,
  duration,
  delay
});

// Reveal con blur + fade-up para scroll
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30, filter: "blur(6px)" },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: motionTransition(i * 0.12)
  })
};

export const cardIn: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: motionTransition(i * 0.1, 0.8)
  })
};

// Para trabajo en conjunto (staggerChildren)
export const staggerParent: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: motionTransition(0, 0.7)
  }
};

export const viewportConfig = { once: true, margin: "-80px 0px -80px 0px" } as const;