import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { etiquetaEnergia, type EnergiaRespaldo } from "@/lib/energia";

/**
 * La etiqueta de energía de respaldo.
 *
 * Un solo componente porque se pinta en tres sitios —la ficha de escritorio, la
 * de móvil y la tarjeta del mapa— y con tres copias la primera vez que se
 * cambie el texto o el color se cambiará en dos.
 *
 * **No se pinta si no hay nada que anunciar**: `etiquetaEnergia` devuelve `null`
 * tanto para quien dijo «ninguna» como para quien no lo rellenó, así que un
 * negocio sin respaldo no gana una chapita que diga «sin respaldo». La ficha
 * enseña lo que el dueño afirma, no lo que le falta.
 *
 * Los colores salen del sistema: el rayo va en el verde de marca y la pastilla
 * en el blanco de las tarjetas, sin inventar un ámbar que la paleta no tiene.
 */
export function EnergiaBadge({
  energia,
  nota,
  className,
}: {
  energia: EnergiaRespaldo | null | undefined;
  /** Nota del dueño sobre cómo lo lleva. Va en el `title`, no en la etiqueta. */
  nota?: string | null;
  className?: string;
}) {
  const label = etiquetaEnergia(energia);
  if (!label) return null;

  return (
    <span
      title={nota?.trim() ? nota.trim() : undefined}
      className={cn(
        "inline-flex items-center gap-[4px] rounded-full border border-ink/10 bg-white px-[10px] py-[3px] font-lv-display text-xs font-semibold uppercase tracking-[0.06em] text-ink",
        className,
      )}
    >
      <Zap size={12} strokeWidth={2.4} className="shrink-0 text-verde-600" />
      {label}
    </span>
  );
}
