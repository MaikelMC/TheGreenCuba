"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EASE } from "@/lib/motion";

type SaveStatus = "saved" | "saving" | "published";

interface SaveBarProps {
  onPublish?: () => void;
  onDiscard?: () => void;
  className?: string;
}

export function SaveBar({ onPublish, onDiscard, className }: SaveBarProps) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handlePublish = useCallback(() => {
    setStatus("published");
    setToastMessage("Cambios publicados");
    setToastVisible(true);
    onPublish?.();
  }, [onPublish]);

  const handleDiscard = useCallback(() => {
    setStatus("saved");
    setToastMessage("Cambios descartados");
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
    onDiscard?.();
  }, [onDiscard]);

  useEffect(() => {
    if (toastVisible) {
      const timer = setTimeout(() => setToastVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastVisible]);

  const statusLabel = status === "published" ? "Publicado" : "Guardado";
  const statusColor = status === "published" ? "text-lv-teal" : "text-muted-foreground";

  return (
    <>
      <div className={cn("sticky bottom-0 py-gap-md px-gap-md flex gap-gap-sm bg-surface/95 backdrop-blur border-t border-border z-10 -mx-gap-md lg:-mx-gap-xl", className)}>
        <motion.span
          key={status}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 24 }}
          className={cn("flex items-center gap-gap-xs font-mono text-meta", statusColor)}
        >
          <Check size={14} strokeWidth={2} />
          {statusLabel}
        </motion.span>
        <div className="flex gap-gap-sm flex-1">
          <Button variant="outline" onClick={handleDiscard} className="flex-1">
            Descartar
          </Button>
          <Button onClick={handlePublish} className="flex-1">
            <Send size={18} strokeWidth={1.5} />
            Publicar cambios
          </Button>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toastVisible && (
          <motion.div
            role="alert"
            aria-live="polite"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed bottom-[80px] left-1/2 -translate-x-1/2 bg-foreground text-surface font-display text-small font-semibold px-6 py-gap-sm rounded-full shadow-lv-lg z-[200] flex items-center gap-gap-xs whitespace-nowrap"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 20 }}
            >
              <Check size={18} strokeWidth={2} className="text-lv-teal" />
            </motion.span>
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
