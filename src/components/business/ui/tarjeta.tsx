import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { CHAPITA, TARJETA, TONO_CHAPITA, type TonoChapita } from "./clases";

/** La tarjeta del panel: blanca, borde de tinta al 5 %, esquinas de 16 px. */
export function TarjetaPanel({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section className={clsx(TARJETA, className)} {...props} />;
}

/** Chapita de estado: «Activo», «Desactivado» o el texto del candado. */
export function Chapita({
  tono,
  className,
  children,
}: {
  tono: TonoChapita;
  className?: string;
  children: ReactNode;
}) {
  return <span className={clsx(CHAPITA, TONO_CHAPITA[tono], className)}>{children}</span>;
}

/**
 * La tarjeta de un ajuste: título con icono, chapita de estado a la derecha y
 * una línea de apoyo. Lo que va debajo —la fila del interruptor, un candado, un
 * formulario plegado— llega como `children`.
 */
export function TarjetaAjuste({
  icono: Icono,
  titulo,
  estado,
  apoyo,
  children,
  id,
  className,
}: {
  icono: LucideIcon;
  titulo: ReactNode;
  /** Normalmente una `Chapita`. */
  estado?: ReactNode;
  apoyo?: ReactNode;
  children?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <TarjetaPanel id={id} className={className}>
      <div className="flex flex-wrap items-center justify-between gap-gap-sm">
        <h2 className="flex items-center gap-gap-xs font-lv-display text-body font-semibold text-ink">
          <Icono size={18} strokeWidth={1.8} className="text-verde-600" />
          {titulo}
        </h2>
        {estado}
      </div>
      {apoyo && (
        <p className="mt-gap-xs max-w-[62ch] text-small text-ink-soft/75">{apoyo}</p>
      )}
      {children}
    </TarjetaPanel>
  );
}

/** La fila con hairline arriba: qué hace a la izquierda, el control a la derecha. */
export function FilaAjuste({
  titulo,
  detalle,
  control,
}: {
  titulo: ReactNode;
  detalle?: ReactNode;
  control: ReactNode;
}) {
  return (
    <div className="mt-gap-md flex items-center justify-between gap-gap-sm border-t border-ink/5 pt-gap-sm">
      <div className="min-w-0 flex-1">
        <div className="text-small font-medium text-ink">{titulo}</div>
        {detalle && <div className="text-meta text-ink-soft/75">{detalle}</div>}
      </div>
      {control}
    </div>
  );
}
