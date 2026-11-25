import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { TARJETA_ADMIN } from "./clases";

/** La tarjeta del panel: blanca, borde de tinta al 5 %, esquinas de 16 px. */
export function TarjetaAdmin({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section className={clsx(TARJETA_ADMIN, className)} {...props} />;
}

/**
 * Una cifra clave. El valor manda y el contexto va debajo; si el dato enlaza a
 * su sección, el enlace lo pone quien la usa, no la tarjeta.
 */
export function TarjetaKpi({
  etiqueta,
  valor,
  detalle,
  icono: Icono,
  className,
}: {
  etiqueta: ReactNode;
  valor: ReactNode;
  detalle?: ReactNode;
  icono?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        TARJETA_ADMIN,
        "flex flex-col gap-gap-xs transition-colors duration-500 ease-outquint",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-gap-xs">
        <span className="font-lv-display text-meta font-semibold uppercase tracking-[0.08em] text-ink-soft/60">
          {etiqueta}
        </span>
        {Icono && (
          <span className="grid size-8 place-items-center rounded-full bg-verde-50 text-verde-700">
            <Icono size={16} strokeWidth={1.8} aria-hidden />
          </span>
        )}
      </div>
      <span className="font-lv-display text-h3 font-bold leading-none text-ink">
        {valor}
      </span>
      {detalle && <span className="text-meta text-ink-soft/75">{detalle}</span>}
    </div>
  );
}

/**
 * La fila de una lista del panel: lo que importa a la izquierda y la acción o
 * el estado a la derecha, separadas por un hairline.
 */
export function FilaLista({
  titulo,
  detalle,
  inicio,
  fin,
  className,
}: {
  titulo: ReactNode;
  detalle?: ReactNode;
  inicio?: ReactNode;
  fin?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-gap-sm border-b border-ink/5 py-gap-sm last:border-b-0",
        className,
      )}
    >
      {inicio && <div className="shrink-0">{inicio}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate font-lv-display text-small font-semibold text-ink">
          {titulo}
        </div>
        {detalle && (
          <div className="truncate text-meta text-ink-soft/75">{detalle}</div>
        )}
      </div>
      {fin && <div className="shrink-0">{fin}</div>}
    </div>
  );
}

/** Estado vacío del panel: icono en disco, una frase y, si toca, una salida. */
export function EstadoVacioAdmin({
  icono: Icono,
  titulo,
  descripcion,
  accion,
}: {
  icono: LucideIcon;
  titulo: ReactNode;
  descripcion?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-gap-sm px-gap-md py-gap-xl text-center">
      <span className="grid size-12 place-items-center rounded-full bg-verde-50 text-verde-700">
        <Icono size={22} strokeWidth={1.8} aria-hidden />
      </span>
      <div>
        <p className="font-lv-display text-body font-semibold text-ink">
          {titulo}
        </p>
        {descripcion && (
          <p className="mx-auto mt-gap-xs max-w-[46ch] text-small text-ink-soft/75">
            {descripcion}
          </p>
        )}
      </div>
      {accion}
    </div>
  );
}
