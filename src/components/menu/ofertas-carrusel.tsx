"use client";

import { Children, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * El pase de las ofertas destacadas.
 *
 * Solo envuelve tarjetas que el servidor ya pintó: el estado vive aquí y lo
 * único que mueve es el `transform` del carril. Sin JavaScript se ve la primera
 * oferta, que es suficiente para enseñar que hay algo rebajado.
 *
 * Las flechas van debajo, a la izquierda de la tarjeta. Encima de la foto se
 * comerían el contenido, y en el teléfono la tarjeta ya es estrecha.
 */
const FLECHA =
  "grid size-10 shrink-0 place-items-center rounded-full border border-ink/10 bg-white text-ink shadow-soft transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 disabled:pointer-events-none disabled:opacity-40";

export function OfertasCarrusel({ children }: { children: ReactNode }) {
  const [indice, setIndice] = useState(0);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const tarjetas = Children.toArray(children);
  const total = tarjetas.length;

  if (total < 2) return <>{tarjetas}</>;

  /* Un dedo sobre la tarjeta también pasa de oferta. Solo cuenta el gesto
     claramente horizontal: si el desplazamiento vertical manda, el usuario
     está haciendo scroll y no se toca nada. */
  const alTocar = (evento: TouchEvent) => {
    const toque = evento.touches[0];
    inicio.current = toque
      ? { x: toque.clientX, y: toque.clientY }
      : null;
  };

  const alSoltar = (evento: TouchEvent) => {
    const desde = inicio.current;
    inicio.current = null;
    if (!desde) return;

    const toque = evento.changedTouches[0];
    if (!toque) return;
    const dx = toque.clientX - desde.x;
    const dy = toque.clientY - desde.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return;

    setIndice((i) => Math.min(total - 1, Math.max(0, i + (dx < 0 ? 1 : -1))));
  };

  return (
    <div>
      <div
        className="overflow-hidden touch-pan-y"
        onTouchStart={alTocar}
        onTouchEnd={alSoltar}
      >
        <div
          className="flex transition-transform duration-500 ease-outquint"
          style={{ transform: `translateX(-${indice * 100}%)` }}
        >
          {tarjetas.map((tarjeta, i) => (
            <div key={i} className="w-full shrink-0">
              {tarjeta}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-gap-sm flex items-center gap-gap-xs">
        <button
          type="button"
          onClick={() => setIndice((i) => i - 1)}
          disabled={indice === 0}
          aria-label="Oferta anterior"
          className={FLECHA}
        >
          <ChevronLeft size={18} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={() => setIndice((i) => i + 1)}
          disabled={indice === total - 1}
          aria-label="Oferta siguiente"
          className={FLECHA}
        >
          <ChevronRight size={18} strokeWidth={1.8} />
        </button>
        <span
          aria-live="polite"
          className="ml-gap-xs font-lv-display text-meta font-semibold tabular-nums text-ink-soft/70"
        >
          {indice + 1} / {total}
        </span>
      </div>
    </div>
  );
}
