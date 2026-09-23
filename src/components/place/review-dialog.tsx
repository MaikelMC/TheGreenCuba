"use client";

import { useState } from "react";
import { Star, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lugar al que se le pone la reseña. */
  placeId: string;
  /** Nombre del negocio, para el título. */
  placeName: string;
  /** Se llamó al publicar y salió bien: quien pinte la lista tiene que releerla. */
  onPublished?: () => void;
}

const STARS = [1, 2, 3, 4, 5];

/** La nota se lee en palabras además de en estrellas: el color y el relleno no
 *  son la única señal. */
const RATING_LABELS = ["Muy malo", "Malo", "Normal", "Bueno", "Excelente"];

const MAX_COMMENT = 500;

const BTN_PRIMARY =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none";

const BTN_GHOST =
  "inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-ink/10 bg-white px-gap-lg font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 disabled:pointer-events-none disabled:opacity-50";

export function ReviewDialog({
  open,
  onOpenChange,
  placeId,
  placeName,
  onPublished,
}: ReviewDialogProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  /* Solo para previsualizar: pasar el ratón por la cuarta estrella enseña cómo
     quedaría un 4 sin llegar a fijarlo. En táctil no hay hover y da igual. */
  const [hovered, setHovered] = useState(0);

  function close() {
    /* Se vacía al cerrar y no al abrir: así el diálogo no enseña por un instante
       la opinión de la vez anterior mientras se anima la entrada. */
    setRating(0);
    setComment("");
    setHovered(0);
    setSending(false);
    onOpenChange(false);
  }

  async function handleSubmit() {
    if (rating === 0 || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, rating, content: comment }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || data?.ok !== true) {
        /* El 401 —ficha abierta sin sesión— trae su propio texto desde el
           servidor: "Entra en tu cuenta para opinar", que es lo que hay que
           hacer. Repetirlo aquí en duro lo dejaría desincronizado. */
        toast.error(data?.error || "No se pudo publicar tu opinión.");
        setSending(false);
        return;
      }

      onPublished?.();
      toast.success("Gracias por tu opinión");
      close();
    } catch {
      toast.error("Sin conexión. No se pudo publicar tu opinión.");
      setSending(false);
    }
  }

  const shown = hovered || rating;
  const label = rating > 0 ? (RATING_LABELS[rating - 1] ?? "") : "";

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="flex max-w-md flex-col gap-gap-md">
        <DialogHeader>
          <DialogTitle className="leading-tight">Opinar sobre {placeName}</DialogTitle>
          <DialogDescription>
            Cuéntanos qué te pareció. Tu opinión ayuda a otros a elegir mejor.
          </DialogDescription>
        </DialogHeader>

        {/* Valoración */}
        <div className="flex flex-col items-center gap-gap-xs rounded-2xl bg-sand-warm p-gap-md">
          <div className="flex items-center gap-[2px]" role="group" aria-label="Tu valoración">
            {STARS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                onFocus={() => setHovered(n)}
                onBlur={() => setHovered(0)}
                aria-pressed={rating === n}
                aria-label={`${n} de 5 ${n === 1 ? "estrella" : "estrellas"}`}
                className="grid size-11 cursor-pointer place-items-center rounded-full transition-transform duration-200 ease-outquint hover:scale-110 active:scale-95"
              >
                <Star
                  size={30}
                  strokeWidth={1.5}
                  className={cn(
                    "transition-colors duration-200",
                    shown >= n ? "fill-verde-400 text-verde-400" : "text-ink/20",
                  )}
                />
              </button>
            ))}
          </div>
          <p
            aria-live="polite"
            className={cn(
              "font-lv-display text-small font-semibold",
              rating > 0 ? "text-verde-700" : "text-ink-soft/60",
            )}
          >
            {label || "Toca una estrella para puntuar"}
          </p>
        </div>

        {/* Comentario */}
        <div className="flex flex-col gap-gap-xs">
          <label
            htmlFor="review-comment"
            className="font-lv-display text-meta font-semibold uppercase tracking-[0.08em] text-ink-soft/75"
          >
            Tu comentario
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={MAX_COMMENT}
            placeholder="¿Qué tal el servicio, el ambiente, la comida?"
            className="w-full resize-none rounded-2xl border border-ink/10 bg-white px-gap-md py-gap-sm font-lv text-small leading-relaxed text-ink placeholder:text-ink-soft/50 transition-colors duration-300 focus-visible:border-verde-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/25"
          />
          <span className="self-end font-lv-display text-meta tabular-nums text-ink-soft/60">
            {comment.length}/{MAX_COMMENT}
          </span>
        </div>

        <DialogFooter className="gap-gap-sm sm:space-x-0">
          <DialogClose asChild>
            <button type="button" disabled={sending} className={BTN_GHOST}>
              Cancelar
            </button>
          </DialogClose>
          {/* Sin nota no hay nada que publicar: la reseña exige la puntuación,
              el texto es opcional. */}
          <button
            type="button"
            disabled={rating === 0 || sending}
            onClick={() => void handleSubmit()}
            className={BTN_PRIMARY}
          >
            <Send size={16} strokeWidth={1.8} />
            {sending ? "Publicando…" : "Publicar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
