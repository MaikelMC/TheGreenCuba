import { Clock, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface OfferBannerProps {
  label: string;
  text: string;
  expiry: string;
  /**
   * Frase del dueño sobre la oferta. Opcional: la escribió él o no la escribió.
   */
  description?: string;
  /**
   * El precio de antes y el de ahora, ya con la moneda puesta.
   *
   * Opcional y puede faltar aunque la oferta exista —un producto sin precio que
   * se pueda leer como cifra, o una rebaja por porcentaje sobre «3–5 USD»—: en
   * ese caso la tarjeta se sostiene con el título y la fecha.
   */
  precio?: { de: string; por: string; ahorroPct?: number };
  visible?: boolean;
  className?: string;
}

/**
 * La oferta flash de la ficha.
 *
 * Mismo acabado que el 2×1 de los precios de la portada (`landing/pricing.tsx`):
 * caja cálida en degradado, dos brillos muy difuminados, el filete de arriba
 * como lazo y la chapita en degradado. Así una oferta se reconoce igual en toda
 * La Verde, y se separa del verde del resto de la ficha, que es justo lo que
 * tiene que hacer una oferta. Las clases son las mismas que las del 2×1 a
 * propósito: sus parejas oscuras ya están en `globals.css`.
 *
 * Componente de servidor. La entrada es un fundido CSS de 250 ms que llega con
 * el HTML y se apaga con movimiento reducido; los brillos son estáticos.
 */
export function OfferBanner({
  label,
  text,
  expiry,
  description,
  precio,
  visible = true,
  className,
}: OfferBannerProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "relative mx-gap-md mb-gap-md overflow-hidden rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 p-gap-md shadow-soft ring-1 ring-inset ring-white/60 animate-[fade-up_250ms_ease-out] motion-reduce:animate-none",
        className,
      )}
    >
      {/* Capa recortada aparte: un `blur` dentro de un contenedor redondeado
          con `overflow-hidden` se escapa del radio en Chrome y Safari. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 isolate transform-gpu overflow-hidden rounded-[inherit]"
      >
        <span className="absolute -right-10 -top-12 size-32 rounded-full bg-orange-300/35 blur-2xl" />
        <span className="absolute -bottom-14 -left-10 size-32 rounded-full bg-red-400/20 blur-2xl" />
        <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/60 to-transparent" />
      </div>

      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-700 to-red-600 px-2.5 py-1 font-lv-display text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-sm">
          <Tag size={12} strokeWidth={2.4} aria-hidden />
          {label}
        </span>

        <p className="mt-gap-sm break-words font-lv-display text-body font-bold leading-snug text-orange-950 text-balance">
          {text}
        </p>

        {description && (
          <p className="mt-[6px] break-words text-small text-orange-900/75 text-pretty">
            {description}
          </p>
        )}

        {precio && (
          /* El precio va suelto sobre la caja, separado por una línea de corte
             como la de un cupón: antes iba en un recuadro blanco dentro de la
             tarjeta, que se leía como una tarjeta dentro de otra. El precio de
             antes arriba y pequeño, el nuevo grande debajo, y el descuento a la
             derecha cuando se puede calcular. */
          <div className="mt-gap-md flex flex-wrap items-end justify-between gap-gap-sm border-t border-dashed border-orange-400/40 pt-gap-sm">
            <p className="min-w-0">
              <span className="block font-lv-display text-small tabular-nums text-orange-900/75">
                <span className="sr-only">Antes </span>
                <span className="line-through decoration-orange-700/60">{precio.de}</span>
              </span>
              <span className="mt-1 block break-words font-lv-display text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums text-orange-700">
                <span className="sr-only">Ahora </span>
                {precio.por}
              </span>
            </p>
            {precio.ahorroPct ? (
              <span className="inline-flex shrink-0 items-center rounded-full border border-orange-400/40 bg-white/60 px-2.5 py-1 font-lv-display text-small font-bold tabular-nums text-orange-700">
                <span aria-hidden>−{precio.ahorroPct} %</span>
                <span className="sr-only">Descuento del {precio.ahorroPct} %</span>
              </span>
            ) : null}
          </div>
        )}

        <p className="mt-gap-sm flex items-center gap-[6px] text-meta font-medium text-orange-900/75">
          <Clock size={13} strokeWidth={2} className="shrink-0" aria-hidden />
          <span className="min-w-0">{expiry}</span>
        </p>
      </div>
    </div>
  );
}
