"use client";

import { motion } from "motion/react";

/**
 * El punto que late sobre un botón cuando hay algo nuevo.
 *
 * Vive aquí porque lo usan la campana de notificaciones y el botón de fuego de
 * las novedades: dos copias del halo se separarían a la primera que alguien
 * retoque una. La posición la pone quien lo monta desde `className`.
 *
 * El halo es lo que se ve de reojo; el punto sólido queda para quien pide menos
 * movimiento. Tres paradas para que el ciclo no vuelva a empezar de golpe:
 * con una sola pasada salía disparado.
 */
export function PuntoNuevo({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute grid place-items-center ${className}`}
    >
      <motion.span
        className="absolute size-3 rounded-full bg-verde-500"
        animate={{
          opacity: [0.45, 0.16, 0],
          scale: [1, 1.42, 1.9],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: "easeInOut",
          times: [0, 0.55, 1],
        }}
      />
      <span className="relative size-3 rounded-full bg-verde-500 ring-2 ring-white" />
    </span>
  );
}
