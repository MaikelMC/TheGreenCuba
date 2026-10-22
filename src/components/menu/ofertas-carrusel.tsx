"use client";

import { Children, useState, type ReactNode } from "react";
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
  const tarjetas = Children.toArray(children);
  const total = tarjetas.length;

  if (total < 2) return <>{tarjetas}</>;

  return (
    <div>
      <div className="overflow-hidden">
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
