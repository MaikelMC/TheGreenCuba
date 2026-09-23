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
}

/* Los cuatro botones comparten caja; solo cambian el color y el borde. Antes
   cada uno repetía la ristra entera y `duration-fast` compilaba a cero, así que
   el cambio de color era instantáneo. */
const BOX =
  "flex flex-col items-center justify-center gap-[6px] py-gap-sm px-gap-xs rounded-2xl border min-h-[72px] transition-colors duration-500 ease-outquint";
const LABEL = "font-lv-display text-xs font-semibold text-center leading-tight";

export function ActionButtons({
  onNavigate,
  onSave,
  onShare,
  onReview,
  isSaved: controlledSaved,
  className,
}: ActionButtonsProps) {
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
    <div className={cn("grid grid-cols-4 gap-gap-xs p-gap-md bg-sand-warm lg:rounded-2xl lg:border lg:border-ink/5 lg:p-gap-lg", className)}>
      {/* Cómo llegar */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onNavigate}
        className={cn(BOX, "border-verde-400 bg-verde-400 hover:border-verde-300 hover:bg-verde-300")}
      >
        <Navigation size={24} strokeWidth={1.8} className="text-verde-950" />
        <span className={cn(LABEL, "text-verde-950")}>Cómo llegar</span>
      </motion.button>

      {/* Guardar */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={handleSave}
        aria-pressed={saved}
        className={cn(
          BOX,
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
            size={24}
            strokeWidth={1.8}
            className="text-verde-600"
            fill={saved ? "currentColor" : "none"}
          />
        </motion.span>
        <span className={cn(LABEL, "text-ink")}>{saved ? "Guardado" : "Guardar"}</span>
      </motion.button>

      {/* Compartir */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onShare}
        className={cn(BOX, "border-ink/10 bg-white hover:border-verde-300 hover:bg-verde-50")}
      >
        <Share2 size={24} strokeWidth={1.8} className="text-verde-600" />
        <span className={cn(LABEL, "text-ink")}>Compartir</span>
      </motion.button>

      {/* Opinar */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onReview}
        className={cn(BOX, "border-ink/10 bg-white hover:border-verde-300 hover:bg-verde-50")}
      >
        <Star size={24} strokeWidth={1.8} className="text-verde-600" />
        <span className={cn(LABEL, "text-ink")}>Opinar</span>
      </motion.button>
    </div>
  );
}
