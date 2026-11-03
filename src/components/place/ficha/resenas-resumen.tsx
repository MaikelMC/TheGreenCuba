"use client";

import { MessageSquare, Star } from "lucide-react";
import type { PlaceRating } from "@/lib/ficha/place-data";
import type { UserPlaceReview } from "@/lib/places-store";
import { COPY, MIN_RESENAS_PARA_NOTA } from "@/config/ficha";
import { cn } from "@/lib/utils";
import { ReviewsSection } from "../reviews-section";

const BTN_OUTLINE =
  "inline-flex h-10 items-center justify-center rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-meta font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600";

/**
 * El resumen de reseñas: media, total, la destacada y la lista completa.
 *
 * La media solo se enseña a partir de `MIN_RESENAS_PARA_NOTA`. Por debajo no se
 * esconde el bloque —hay opiniones y se pueden leer—, pero no se presenta una
 * nota: se dice cuántas hay. Sin ninguna reseña queda el bloque mínimo con la
 * invitación a opinar, sin cifras.
 */
export function ResenasResumen({
  placeId,
  rating,
  destacada,
  reloadKey = 0,
  onOpinion,
  className,
}: {
  placeId: string;
  rating: PlaceRating | null;
  destacada: UserPlaceReview | null;
  reloadKey?: number;
  onOpinion?: () => void;
  className?: string;
}) {
  const total = rating?.total ?? 0;
  const promedio = rating?.promedio ?? 0;
  const conNota = total >= MIN_RESENAS_PARA_NOTA && promedio > 0;

  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-gap-md flex items-center justify-between gap-gap-sm">
        <h2 className="font-lv-display text-h3 font-bold text-ink">Reseñas</h2>
        {onOpinion && (
          <button type="button" onClick={onOpinion} className={BTN_OUTLINE}>
            {COPY.opinar}
          </button>
        )}
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/10 bg-sand-warm/60 p-gap-lg">
          <div className="flex items-start gap-gap-sm">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-verde-50 text-verde-600">
              <MessageSquare size={18} strokeWidth={1.8} />
            </span>
            <div>
              <p className="font-lv-display text-small font-semibold text-ink">
                {COPY.sinResenas}
              </p>
              <p className="mt-[2px] text-meta leading-relaxed text-ink-soft/70">
                {COPY.invitarResena}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-gap-md gap-y-gap-xs">
            {conNota && (
              <span className="font-lv-display text-h1 font-bold leading-none tracking-[-0.03em] text-ink">
                {promedio.toFixed(1)}
              </span>
            )}
            <div className="flex flex-col gap-[3px]">
              {conNota && <Estrellas value={promedio} />}
              <span className="font-lv-display text-meta text-ink-soft/70">
                {total} {total === 1 ? COPY.resena : COPY.resenas}
              </span>
            </div>
          </div>

          {destacada && (
            <figure className="mt-gap-md rounded-2xl border border-verde-100 bg-verde-50/60 p-gap-md">
              <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.08em] text-verde-700">
                {COPY.resenaDestacada}
              </p>
              <Estrellas value={destacada.rating} className="mt-gap-xs" />
              {destacada.content && (
                <blockquote className="mt-gap-xs text-pretty text-body leading-relaxed text-ink">
                  {destacada.content}
                </blockquote>
              )}
              <figcaption className="mt-gap-xs font-lv-display text-meta font-semibold text-ink-soft/75">
                {destacada.author || "Alguien de La Verde"}
              </figcaption>
              {destacada.respuesta && (
                <div className="mt-gap-sm rounded-xl border border-verde-200/70 bg-white/70 p-gap-sm">
                  <p className="font-lv-display text-meta font-semibold text-verde-700">
                    {COPY.respuestaNegocio}
                  </p>
                  <p className="mt-[2px] whitespace-pre-wrap text-small leading-relaxed text-ink-soft/90">
                    {destacada.respuesta}
                  </p>
                </div>
              )}
            </figure>
          )}

          <div className="mt-gap-md">
            <ReviewsSection
              placeId={placeId}
              reloadKey={reloadKey}
              sinCabecera
            />
          </div>
        </>
      )}
    </section>
  );
}

function Estrellas({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`${value.toFixed(1)} de 5`}
      className={cn("flex items-center gap-[2px]", className)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          strokeWidth={1.6}
          aria-hidden
          className={
            n <= Math.round(value)
              ? "fill-verde-500 text-verde-500"
              : "text-ink/20"
          }
        />
      ))}
    </span>
  );
}
