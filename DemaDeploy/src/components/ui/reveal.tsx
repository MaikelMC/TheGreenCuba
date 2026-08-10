"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { easeOutQuint, viewportConfig } from "@/lib/motion";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "span" | "li" | "section";
}

// Envoltura de entrada con fade + deslizamiento + blur. Respeta prefers-reduced-motion.
export default function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = "div"
}: RevealProps) {
  const reduce = useReducedMotion();
  const Tag = motion[as] as typeof motion.div;

  return (
    <Tag
      className={className}
      initial={
        reduce
          ? { opacity: 0 }
          : { opacity: 0, y, filter: "blur(6px)" }
      }
      whileInView={
        reduce
          ? { opacity: 1 }
          : { opacity: 1, y: 0, filter: "blur(0px)" }
      }
      viewport={viewportConfig}
      transition={{ duration: 0.9, ease: easeOutQuint, delay }}
    >
      {children}
    </Tag>
  );
}