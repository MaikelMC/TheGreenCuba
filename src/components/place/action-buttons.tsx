"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Navigation, Heart, Share2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionButtonsProps {
  onNavigate?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onWannaGo?: () => void;
  isSaved?: boolean;
  className?: string;
}

export function ActionButtons({
  onNavigate,
  onSave,
  onShare,
  onWannaGo,
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
    <div className={cn("grid grid-cols-4 gap-gap-xs p-gap-md bg-surface lg:rounded-lv-lg lg:border lg:border-border lg:p-gap-lg", className)}>
      {/* Cómo llegar */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onNavigate}
        className="flex flex-col items-center justify-center gap-[6px] py-gap-sm px-gap-xs rounded-lv-lg border border-accent bg-accent text-white hover:bg-accent-hover hover:border-accent-hover transition-colors duration-fast min-h-[72px]"
      >
        <Navigation size={24} strokeWidth={2} className="text-white" />
        <span className="font-display text-xs font-semibold text-white text-center leading-tight">
          Cómo llegar
        </span>
      </motion.button>

      {/* Guardar */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={handleSave}
        className={cn(
          "flex flex-col items-center justify-center gap-[6px] py-gap-sm px-gap-xs rounded-lv-lg border transition-colors duration-fast min-h-[72px]",
          saved
            ? "border-accent bg-accent/10"
            : "border-border bg-surface hover:border-accent hover:bg-accent/10",
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
            strokeWidth={2}
            className="text-accent"
            fill={saved ? "currentColor" : "none"}
          />
        </motion.span>
        <span className="font-display text-xs font-semibold text-foreground text-center leading-tight">
          {saved ? "Guardado" : "Guardar"}
        </span>
      </motion.button>

      {/* Compartir */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onShare}
        className="flex flex-col items-center justify-center gap-[6px] py-gap-sm px-gap-xs rounded-lv-lg border border-border bg-surface hover:border-accent hover:bg-accent/10 transition-colors duration-fast min-h-[72px]"
      >
        <Share2 size={24} strokeWidth={2} className="text-accent" />
        <span className="font-display text-xs font-semibold text-foreground text-center leading-tight">
          Compartir
        </span>
      </motion.button>

      {/* Quiero ir */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onWannaGo}
        className="flex flex-col items-center justify-center gap-[6px] py-gap-sm px-gap-xs rounded-lv-lg border border-border bg-surface hover:border-accent hover:bg-accent/10 transition-colors duration-fast min-h-[72px]"
      >
        <Users size={24} strokeWidth={2} className="text-accent" />
        <span className="font-display text-xs font-semibold text-foreground text-center leading-tight">
          Quiero ir
        </span>
      </motion.button>
    </div>
  );
}
