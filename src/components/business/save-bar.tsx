"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EASE } from "@/lib/motion";

type SaveStatus = "saved" | "saving" | "published";

interface SaveBarProps {
  onPublish?: () => void;
  onDiscard?: () => void;
  className?: string;
}

/* El `border-border` gris y el `bg-surface` del sistema viejo dejan paso a la
   hairline de tinta y al blanco del sistema. `duration-normal` tampoco existía
   en la escala de Tailwind: compilaba a cero y las transiciones eran de golpe. */
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
  const statusColor = status === "published" ? "text-verde-600" : "text-ink-soft/75";

  return (
    <>
      {/* Los márgenes negativos tienen que seguir el relleno de `main` del
          panel, que en móvil es `gap-sm`: con `-mx-gap-md` la barra se salía
          4 px por lado y abría scroll horizontal. */}
      {/* En móvil los botones van uno encima del otro y el primario arriba
          (`flex-col-reverse`). En fila a 360 px no caben: "Publicar cambios"
          con su icono pide ~190 px y el botón se queda en ~156, así que el
          `whitespace-nowrap` de `Button` lo sacaba fuera. */}
      <div className={cn("sticky bottom-0 py-gap-md px-gap-sm sm:px-gap-md flex flex-col sm:flex-row sm:items-center gap-gap-sm bg-sand-warm/95 backdrop-blur-[16px] border-t border-ink/5 z-10 -mx-gap-sm sm:-mx-gap-md lg:-mx-gap-xl", className)}>
        <motion.span
          key={status}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 24 }}
          className={cn("flex items-center gap-gap-xs font-lv-display text-meta whitespace-nowrap", statusColor)}
        >
          <Check size={14} strokeWidth={1.8} />
          {statusLabel}
        </motion.span>
        <div className="flex flex-col-reverse sm:flex-row gap-gap-sm flex-1">
          <Button
            variant="outline"
            onClick={handleDiscard}
            className="flex-1 rounded-full border-ink/10 bg-white text-ink hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 duration-500 ease-outquint"
          >
            Descartar
          </Button>
          <Button
            onClick={handlePublish}
            className="flex-1 rounded-full bg-verde-400 text-verde-950 shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] hover:bg-verde-300 duration-500 ease-outquint active:scale-[0.98]"
          >
            <Send size={18} strokeWidth={1.8} />
            Publicar cambios
          </Button>
        </div>
      </div>

      {/* Toast. `bottom-above-nav` y no un valor fijo: en iOS el inset del
          indicador de inicio añade ~34 px y el aviso se posaba encima de la
          barra inferior. `max-w` evita que un mensaje largo se salga de la
          pantalla; el `whitespace-nowrap` solo no basta. */}
      <AnimatePresence>
        {toastVisible && (
          <motion.div
            role="alert"
            aria-live="polite"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed bottom-above-nav left-1/2 -translate-x-1/2 bg-ink text-white font-lv-display text-small font-semibold px-6 py-gap-sm rounded-full shadow-card z-[200] flex items-center gap-gap-xs whitespace-nowrap max-w-[calc(100vw_-_32px)]"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 20 }}
            >
              <Check size={18} strokeWidth={1.8} className="text-verde-300" />
            </motion.span>
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
