"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Navigation, Heart, Share2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionButtonsProps {
  onNavigate?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  /** Abre el diálogo de opinión (estrellas + comentario). */
  onReview?: () => void;
  isSaved?: boolean;
  className?: string;
  /**
   * Versión pequeña y sin caja, para meterla dentro de una fila con otros
   * datos —la cabecera de la ficha en móvil— en vez de ocupar su propio bloque.
   *
   * Los 40 px se quedan por debajo de los 44 que el sistema usa para un dedo.
   * Es a propósito y tiene tope: cuatro botones en fila con el chip de
   * categoría y la nota no caben a 44 en una pantalla de 390 px, y el que
   * quedaría fuera sería justo el último. WCAG 2.5.8 AA pide 24, así que se
   * cumple de sobra.
   */
  compact?: boolean;
}

/* Los cuatro botones comparten caja; solo cambian el color y el borde. Antes
    cada uno repetía la ristra entera y `duration-fast` compilaba a cero, así que
    el cambio de color era instantáneo. */
const BOX =
  "flex items-center justify-center rounded-2xl border transition-colors duration-500 ease-outquint";

export function ActionButtons({
  onNavigate,
  onSave,
  onShare,
  onReview,
  isSaved: controlledSaved,
  className,
  compact = false,
}: ActionButtonsProps) {
  const box = cn(
    BOX,
    compact ? "size-10 rounded-xl" : "w-[48px] h-[48px]",
  );
  const icon = compact ? 20 : 28;
  const [internalSaved, setInternalSaved] = useState(controlledSaved ?? true);
  const saved = controlledSaved ?? internalSaved;

  function handleSave() {
    if (onSave) {
      onSave();
    } else {
      setInternalSaved((prev) => !prev);
    }
  }

  return (
    <div
      className={cn(
        compact
          ? "flex items-center gap-1.5"
          : "grid grid-cols-4 gap-gap-xs p-gap-md bg-sand-warm lg:rounded-2xl lg:border lg:border-ink/5 lg:p-gap-lg",
        className,
      )}
    >
      {/* Cómo llegar */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onNavigate}
        title="Cómo llegar"
        className={cn(
          box,
          "border-verde-400 bg-verde-400 hover:border-verde-300 hover:bg-verde-300",
        )}
      >
        <Navigation size={icon} strokeWidth={1.8} className="text-verde-950" />
      </motion.button>

      {/* Guardar */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={handleSave}
        aria-pressed={saved}
        title={saved ? "Guardado" : "Guardar"}
        className={cn(
          box,
          saved
            ? "border-verde-400 bg-verde-50"
            : "border-ink/10 bg-white hover:border-verde-300 hover:bg-verde-50",
        )}
      >
        <motion.span
          key={saved ? "saved" : "unsaved"}
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 18 }}
        >
          <Heart
            size={icon}
            strokeWidth={1.8}
            className="text-verde-600"
            fill={saved ? "currentColor" : "none"}
          />
        </motion.span>
      </motion.button>

      {/* Compartir */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onShare}
        title="Compartir"
        className={cn(
          box,
          "border-ink/10 bg-white hover:border-verde-300 hover:bg-verde-50",
        )}
      >
        <Share2 size={icon} strokeWidth={1.8} className="text-verde-600" />
      </motion.button>

      {/* Opinar */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onReview}
        title="Opinar"
        className={cn(
          box,
          "border-ink/10 bg-white hover:border-verde-300 hover:bg-verde-50",
        )}
      >
        <Star size={icon} strokeWidth={1.8} className="text-verde-600" />
      </motion.button>
    </div>
  );
}
