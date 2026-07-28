"use client";

import { useState, useCallback, useEffect } from "react";
import { Check, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const statusIcon = status === "published" ? Check : Check;
  const statusColor = status === "published" ? "text-lv-teal" : "text-muted-foreground";

  return (
    <>
      <div className={cn("sticky bottom-0 py-gap-md flex gap-gap-sm bg-gradient-to-t from-background/80 to-transparent z-10", className)}>
        <span className={cn("flex items-center gap-gap-xs font-mono text-meta", statusColor)}>
          <Check size={14} strokeWidth={2} />
          {statusLabel}
        </span>
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
      <div
        role="alert"
        aria-live="polite"
        className={cn(
          "fixed bottom-[80px] left-1/2 -translate-x-1/2 bg-foreground text-surface font-display text-small font-semibold px-6 py-gap-sm rounded-full shadow-lv-lg z-[200] flex items-center gap-gap-xs transition-all duration-slow ease-out whitespace-nowrap",
          toastVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-5 pointer-events-none",
        )}
      >
        <Check size={18} strokeWidth={2} className="text-lv-teal" />
        {toastMessage}
      </div>
    </>
  );
}
