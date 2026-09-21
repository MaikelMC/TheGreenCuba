"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
/* `relativeDay` es una función pura de formato —"hoy", "ayer", "hace 3 días"— y
   vive en el store de actividad porque fue ahí donde hizo falta primero. El
   texto que devuelve es el mismo que se quiere para una reseña. */
import { relativeDay } from "@/lib/activity-store";
import { Skeleton } from "@/components/ui/loading";
import { StateView } from "@/components/ui/state-view";

/** Una reseña tal como la devuelve `/api/reviews`. */
interface Review {
  id: string;
  rating: number;
  content: string | null;
  /** ISO 8601: el `Date` del servidor viaja serializado. */
  createdAt: string;
  author: string | null;
}

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; reviews: Review[]; count: number; average: number };

interface ReviewsSectionProps {
  placeId: string;
  /** Cambia al publicar una reseña. Obliga a releer: sin esto, quien acaba de
   *  opinar vería su reseña en ningún sitio y creería que no se guardó. */
  reloadKey?: number;
  className?: string;
}

const H2 = "font-lv-display text-h3 font-bold text-ink";

const BTN_OUTLINE =
  "inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-ink/10 bg-white px-gap-lg font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50";

export function ReviewsSection({
  placeId,
  reloadKey = 0,
  className,
}: ReviewsSectionProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  /* Reintento manual: entra en las dependencias del efecto como si fuera otro
     lugar al que preguntar. */
  const [retry, setRetry] = useState(0);

  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        const res = await fetch(
          `/api/reviews?placeId=${encodeURIComponent(placeId)}`,
          { signal },
        );
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          reviews?: Review[];
          count?: number;
          average?: number;
        } | null;
        if (signal.aborted) return;

        if (!res.ok || data?.ok !== true) {
          setState({ status: "error" });
          return;
        }
        setState({
          status: "ready",
          reviews: data.reviews ?? [],
          count: data.count ?? 0,
          average: data.average ?? 0,
        });
      } catch {
        /* El `AbortError` de desmontar o de cambiar de lugar no es un fallo que
           merezca pintar el estado de error. */
        if (!signal.aborted) setState({ status: "error" });
      }
    },
    [placeId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reloadKey, retry]);

  const count = state.status === "ready" ? state.count : 0;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-gap-md">
        <h2 className={H2}>Reseñas</h2>
        {state.status === "ready" && count > 0 && (
          <span className="inline-flex items-center gap-[6px] font-lv-display text-small font-semibold text-ink">
            <Star size={14} strokeWidth={1.8} className="fill-verde-400 text-verde-400" />
            {state.average.toFixed(1)}
            {/* La media sola no dice sobre cuánta gente: con una sola opinión un
                5,0 y un 4,9 no significan lo mismo. */}
            <span className="font-normal text-ink-soft/75">
              ({count === 1 ? "1 opinión" : `${count} opiniones`})
            </span>
          </span>
        )}
      </div>

      {state.status === "loading" && (
        <div className="flex flex-col gap-gap-sm" aria-busy>
          <Skeleton className="h-[96px] w-full" />
          <Skeleton className="h-[96px] w-full" />
        </div>
      )}

      {state.status === "error" && (
        <div className="border border-dashed border-ink/10 rounded-2xl">
          <StateView
            icon={MessageSquare}
            title="No se pudieron cargar las reseñas"
            description="Puede ser la conexión. Prueba otra vez en un momento."
            actions={
              <button
                type="button"
                onClick={() => setRetry((k) => k + 1)}
                className={BTN_OUTLINE}
              >
                Reintentar
              </button>
            }
          />
        </div>
      )}

      {state.status === "ready" && count === 0 && (
        <div className="border border-dashed border-ink/10 rounded-2xl">
          <StateView
            icon={MessageSquare}
            title="Todavía no hay reseñas"
            description="Sé el primero en contar qué te pareció este lugar."
          />
        </div>
      )}

      {state.status === "ready" && count > 0 && (
        <ul className="flex flex-col gap-gap-sm">
          {state.reviews.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewItem({ review }: { review: Review }) {
  const initial = (review.author?.trim()[0] ?? "?").toUpperCase();

  return (
    <li className="rounded-2xl border border-ink/10 bg-sand-warm p-gap-md">
      <div className="flex items-start gap-gap-sm">
        {/* La inicial es decoración: el nombre va al lado, en texto. */}
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full border border-verde-200 bg-verde-50 font-lv-display text-small font-bold text-verde-700"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-gap-sm">
            <span className="truncate font-lv-display text-small font-semibold text-ink">
              {review.author || "Alguien de La Verde"}
            </span>
            <span className="shrink-0 font-lv-display text-meta text-ink-soft/75">
              {relativeDay(new Date(review.createdAt).getTime())}
            </span>
          </div>
          <Stars value={review.rating} className="mt-[2px]" />
          {review.content && (
            <p className="mt-gap-xs text-small leading-relaxed text-ink text-pretty">
              {review.content}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * Cinco estrellas de solo lectura.
 *
 * La nota va en el `aria-label` del conjunto: sin él, un lector de pantalla
 * encontraría cinco iconos sueltos y ningún número.
 */
function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`${value} de 5`}
      className={cn("flex items-center gap-[2px]", className)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={12}
          strokeWidth={1.8}
          aria-hidden
          className={n <= value ? "fill-verde-400 text-verde-400" : "text-ink/20"}
        />
      ))}
    </span>
  );
}
