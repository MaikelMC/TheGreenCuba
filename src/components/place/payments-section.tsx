"use client";

import { CreditCard } from "lucide-react";
import { cn, currencyLabel, currencyStyles } from "@/lib/utils";

interface PaymentsSectionProps {
  payments: string[];
  className?: string;
}

/**
 * Los métodos de pago como chapitas.
 *
 * Solo en móvil: en escritorio los paga `InfoBar`. El fondo y el relleno llegan
 * por `className`, que es de quien lo coloca —aquí forman parte de la banda de
 * cabecera, con el mismo tono que el bloque del nombre—.
 */
export function PaymentsSection({ payments, className }: PaymentsSectionProps) {
  if (payments.length === 0) return null;

  return (
    <div className={cn("mb-gap-lg px-gap-md", className)}>
      <div className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
        <CreditCard size={14} strokeWidth={1.8} className="text-verde-600" />
        <span className="font-lv-display font-medium text-ink">Pagos</span>
      </div>
      {/* La chapita lleva relleno tonal, anillo hacia dentro y un punto del color
          del texto: sin nada de eso eran cuatro rectángulos planos de 10 px que
          se leían como un pie de tabla. El tono sale de `currencyStyles` y sigue
          sin distinguir monedas entre sí —el rótulo ya las dice—. */}
      <div className="flex gap-1.5 flex-wrap mt-gap-sm">
        {payments.map((c) => (
          <span
            key={c}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm ring-1 ring-inset font-lv-display text-[11px] font-semibold uppercase tracking-[0.06em]",
              currencyStyles[c] ?? "bg-sand-deep text-ink-soft ring-ink/10",
            )}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-current opacity-60" />
            {currencyLabel(c)}
          </span>
        ))}
      </div>
    </div>
  );
}
