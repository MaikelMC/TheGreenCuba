"use client";

import {
  Heart,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCION_LABEL, type AccionFicha } from "@/lib/ficha/acciones";
import { COPY } from "@/config/ficha";

const ICONO: Record<AccionFicha, LucideIcon> = {
  como_llegar: Navigation,
  guardar: Heart,
  llamar: Phone,
  whatsapp: MessageCircle,
  compartir: Share2,
  ofertas: Tag,
};

/**
 * La fila de acciones del dueño: hasta cuatro botones con icono y etiqueta.
 *
 * El filtro de disponibilidad ya se hizo en `place-data`/`resolverFila`: aquí no
 * se pinta una acción que no tenga detrás el dato que promete. La primera —«Cómo
 * llegar»— va rellena porque es el gesto que más se repite desde una ficha; el
 * resto, en contorno.
 */
export function FilaAcciones({
  acciones,
  phone,
  whatsapp,
  enlaceOfertas,
  isSaved,
  onSave,
  onShare,
  onNavigate,
  className,
}: {
  acciones: AccionFicha[];
  phone?: string;
  whatsapp?: string;
  enlaceOfertas?: string;
  isSaved?: boolean;
  onSave?: () => void;
  onShare?: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  if (acciones.length === 0) return null;

  return (
    <div
      className={cn("grid grid-cols-2 gap-gap-xs sm:grid-cols-4", className)}
    >
      {acciones.map((accion) => {
        const Icono = ICONO[accion];
        const primaria = accion === "como_llegar";
        const clase = cn(
          "inline-flex h-12 items-center justify-center gap-gap-xs rounded-2xl border px-gap-sm font-lv-display text-small font-semibold transition-colors duration-500 ease-outquint active:scale-[0.98]",
          primaria
            ? "border-verde-400 bg-verde-400 text-verde-950 hover:border-verde-300 hover:bg-verde-300"
            : "border-ink/10 bg-white text-ink hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
        );

        if (accion === "guardar") {
          return (
            <button
              key={accion}
              type="button"
              onClick={onSave}
              aria-pressed={Boolean(isSaved)}
              className={cn(
                clase,
                isSaved && "border-verde-300 bg-verde-50 text-verde-700",
              )}
              title={isSaved ? COPY.guardado : COPY.guardar}
            >
              <Heart
                size={17}
                strokeWidth={1.8}
                className="shrink-0 text-verde-600"
                fill={isSaved ? "currentColor" : "none"}
              />
              {isSaved ? COPY.guardado : COPY.guardar}
            </button>
          );
        }

        if (accion === "compartir") {
          return (
            <button
              key={accion}
              type="button"
              onClick={onShare}
              className={clase}
              title={COPY.compartir}
            >
              <Icono
                size={17}
                strokeWidth={1.8}
                className="shrink-0 text-verde-600"
              />
              {COPY.compartir}
            </button>
          );
        }

        if (accion === "como_llegar") {
          return (
            <button
              key={accion}
              type="button"
              onClick={onNavigate}
              className={clase}
              title={COPY.comoLlegar}
            >
              <Icono size={17} strokeWidth={1.8} className="shrink-0" />
              {COPY.comoLlegar}
            </button>
          );
        }

        if (accion === "llamar" && phone) {
          return (
            <a
              key={accion}
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className={clase}
              title={COPY.llamar}
            >
              <Icono
                size={17}
                strokeWidth={1.8}
                className="shrink-0 text-verde-600"
              />
              {COPY.llamar}
            </a>
          );
        }

        if (accion === "whatsapp" && whatsapp) {
          return (
            <a
              key={accion}
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={clase}
              title={COPY.whatsapp}
            >
              <Icono
                size={17}
                strokeWidth={1.8}
                className="shrink-0 text-verde-600"
              />
              {COPY.whatsapp}
            </a>
          );
        }

        if (accion === "ofertas" && enlaceOfertas) {
          return (
            <a
              key={accion}
              href={enlaceOfertas}
              target="_blank"
              rel="noopener noreferrer"
              className={clase}
              title={COPY.ofertas}
            >
              <Icono
                size={17}
                strokeWidth={1.8}
                className="shrink-0 text-verde-600"
              />
              {COPY.ofertas}
            </a>
          );
        }

        /* Una acción sin el dato que la sostiene no se pinta. `resolverFila` ya
           la quitó; esto es la red por si alguien la cuela desde otro sitio. */
        return null;
      })}
    </div>
  );
}

/** El nombre de la acción, para la barra fija y los `title`. */
export function etiquetaAccion(
  accion: AccionFicha | keyof typeof ACCION_LABEL,
) {
  return ACCION_LABEL[accion];
}
