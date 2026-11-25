import { clsx } from "clsx";

/**
 * Barra de progreso del panel. `pct` se recorta a 0–100 y se redondea: la barra
 * nunca miente hacia fuera por un dato mal calculado.
 */
export function BarraProgreso({
  pct,
  etiqueta,
  className,
}: {
  pct: number;
  etiqueta: string;
  className?: string;
}) {
  const valor = Math.min(
    100,
    Math.max(0, Math.round(Number.isFinite(pct) ? pct : 0)),
  );

  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valor}
      className={clsx(
        "h-1.5 w-full overflow-hidden rounded-full bg-sand-deep",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-verde-400 transition-[width] duration-500 ease-outquint"
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}
