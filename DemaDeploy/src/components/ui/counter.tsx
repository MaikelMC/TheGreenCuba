"use client";

import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  useTransform,
  useMotionValue
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface CounterProps {
  to: number;
  from?: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

// Conteo animado estilo Framer al entrar en viewport. Respeta reduced motion.
export default function Counter({
  to,
  from = 0,
  duration = 1.8,
  format = (n) => Math.round(n).toLocaleString("es"),
  className
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(format(from));
  const raw = useMotionValue(from);
  const progress = useTransform(raw, (v) => v);
  const controls = useRef<ReturnType<typeof animate> | null>(null);
  const latest = useRef(from);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(format(to));
      return;
    }
    latest.current = from;
    raw.set(from);
    controls.current = animate(raw, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        latest.current = v;
        setDisplay(format(v));
      }
    });
    return () => controls.current?.stop();
  }, [inView, to, reduce, duration, from, raw, format]);

  void progress;

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}