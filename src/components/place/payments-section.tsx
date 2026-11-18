"use client";

import { CreditCard } from "lucide-react";
import { COPY } from "@/config/ficha";
import { etiquetaPago } from "@/lib/ficha/pagos";
import type { MonedaVista } from "@/lib/precios";
import { cn, currencyStyles } from "@/lib/utils";

interface PaymentsSectionProps {
  payments: string[];
  className?: string;
  /** Monedas con tasa configurada: su chapita es un botón que cambia la carta. */
  convertibles?: MonedaVista[];
  seleccionada?: MonedaVista | null;
  onSeleccionar?: (moneda: MonedaVista | null) => void;
}

const CHAPITA =
  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm ring-1 ring-inset font-lv-display text-[11px] font-semibold uppercase tracking-[0.06em]";

/**
 * Los métodos de pago como chapitas.
 *
 * Solo en móvil: en escritorio los paga `InfoBar`. El fondo y el relleno llegan
 * por `className`, que es de quien lo coloca —aquí forman parte de la banda de
 * cabecera, con el mismo tono que el bloque del nombre—.
 *
 * Si el negocio configuró la tasa de una moneda, su chapita se toca: la carta
 * pasa a esa moneda, y tocarla otra vez vuelve a los precios del dueño.
 */
export function PaymentsSection({
  payments,
  className,
  convertibles = [],
  seleccionada = null,
  onSeleccionar,
}: PaymentsSectionProps) {
  if (payments.length === 0) return null;
  const hayConvertibles = Boolean(onSeleccionar) && convertibles.length > 0;

  return (
    <div className={cn("mb-gap-lg px-gap-md", className)}>
      <div className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
        <CreditCard size={14} strokeWidth={1.8} className="text-verde-600" />
        <span className="font-lv-display font-medium text-ink">
          {COPY.pagos}
        </span>
      </div>
      {/* La chapita lleva relleno tonal, anillo hacia dentro y un punto del color
          del texto: sin nada de eso eran cuatro rectángulos planos de 10 px que
          se leían como un pie de tabla. El tono sale de `currencyStyles` y sigue
          sin distinguir monedas entre sí —el rótulo ya las dice—. */}
      <div className="flex gap-1.5 flex-wrap mt-gap-sm">
        {payments.map((c) => {
          const contenido = (
            <>
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-current opacity-60"
              />
              {etiquetaPago(c)}
            </>
          );
          const moneda = convertibles.find((m) => m === c);
          if (!hayConvertibles || !moneda) {
            return (
              <span
                key={c}
                className={cn(
                  CHAPITA,
                  currencyStyles[c] ?? "bg-sand-deep text-ink-soft ring-ink/10",
                )}
              >
                {contenido}
              </span>
            );
          }
          const activa = seleccionada === moneda;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={activa}
              onClick={() => onSeleccionar?.(activa ? null : moneda)}
              className={cn(
                CHAPITA,
                "cursor-pointer transition duration-500 ease-outquint active:scale-[0.98]",
                activa
                  ? "bg-verde-400 text-verde-950 ring-verde-400"
                  : (currencyStyles[c] ?? "bg-sand-deep text-ink-soft ring-ink/10"),
              )}
            >
              {contenido}
            </button>
          );
        })}
      </div>
      {hayConvertibles && (
        <p className="mt-gap-xs text-meta text-ink-soft/75">
          {seleccionada
            ? `Carta en ${etiquetaPago(seleccionada)}, con la tasa del negocio. Toca otra vez para volver.`
            : "Toca una moneda para ver la carta en ella."}
        </p>
      )}
    </div>
  );
}
