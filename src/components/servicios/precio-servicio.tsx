import type { Catalogo } from "@/lib/plans";
import { textoCup } from "@/lib/plans";
import type { PrecioPieza } from "@/content/servicios";

interface Props {
  precio: PrecioPieza;
  catalogo: Catalogo;
}

/** «1,5» en vez de «1.5», igual que en las tarjetas de plan. */
function precioUsd(usd: number) {
  return usd % 1 === 0 ? String(usd) : usd.toFixed(1).replace(".", ",");
}

/**
 * El precio de una pieza del catálogo, con el sistema de diseño de La Verde:
 * cifra en display, aclaración en tinta suave y el CUP con la tasa del día.
 *
 * Los tonos son los del sistema (`ink` / `ink-soft`), no los tokens shadcn
 * (`foreground` / `muted-foreground`): esos no se actualizan con
 * `data-theme="dark"` y dejaban texto oscuro sobre tarjeta oscura.
 */
export function PrecioServicio({ precio, catalogo }: Props) {
  if (precio.tipo === "incluido") {
    const modulo = catalogo.modulos[precio.en];
    return (
      <p className="text-small leading-relaxed text-ink-soft/75">
        Incluido en{" "}
        <span className="font-semibold text-ink">{modulo.nombre}</span>
        <span aria-hidden className="mx-1.5 text-ink-soft/35">
          ·
        </span>
        <span className="font-lv-display font-semibold text-ink">
          ${precioUsd(modulo.usd)}
        </span>{" "}
        <span className="text-ink-soft/60">
          ({textoCup(modulo.usd, catalogo)})
        </span>
      </p>
    );
  }

  const modulo = catalogo.modulos[precio.clave];
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-lv-display text-4xl font-bold tracking-[-0.04em] text-ink">
        ${precioUsd(modulo.usd)}
      </span>
      <span className="text-small font-medium text-ink-soft/65">USD / mes</span>
      <span className="text-small text-ink-soft/55">
        · {textoCup(modulo.usd, catalogo)} al cambio de hoy
      </span>
    </div>
  );
}
