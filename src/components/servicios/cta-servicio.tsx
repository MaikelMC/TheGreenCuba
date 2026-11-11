"use client";

import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPPORT_WHATSAPP } from "@/lib/legal";
import type { ServicioContent } from "@/content/servicios";

interface Props {
  servicio: Pick<ServicioContent, "nombre" | "anclaPanel">;
  tieneServicio: boolean;
  tieneNegocio: boolean;
  esAutenticado: boolean;
  /** El bloque donde vive el CTA es oscuro en los dos temas (cierre de ficha). */
  onDark?: boolean;
}

/** Botones del sistema: pastilla, 48 px de alto y la curva `ease-outquint`. */
const BOTON_BASE =
  "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 font-lv-display text-sm font-semibold leading-none transition duration-300 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/60 active:scale-[0.98]";

const BOTON_PRIMARIO = "bg-verde-400 text-verde-950 hover:bg-verde-300";

const BOTON_SECUNDARIO =
  "border border-ink/15 bg-white text-ink hover:border-verde-300 hover:bg-verde-50 hover:text-verde-700";

/**
 * El CTA de la ficha de servicio.
 *
 * Usa las pastillas del diseño de La Verde y no el `Button` de shadcn: ese va
 * con `rounded-lv` (10 px) y los tokens semánticos, que no cambian con
 * `data-theme="dark"`. Aquí los dos botones comparten forma y curva con el
 * resto del sitio.
 */
export function CtaServicio({
  servicio,
  tieneServicio,
  tieneNegocio,
  esAutenticado,
  onDark = false,
}: Props) {
  const textoWa = `Hola, quiero saber más sobre el servicio «${servicio.nombre}» en La Verde`;
  const waHref = `https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, "")}?text=${encodeURIComponent(textoWa)}`;

  const primario = cn(BOTON_BASE, BOTON_PRIMARIO);
  const secundario = cn(
    BOTON_BASE,
    onDark
      ? "border border-white/25 text-white hover:border-white/45 hover:bg-white/10"
      : BOTON_SECUNDARIO,
  );

  if (tieneServicio) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={servicio.anclaPanel} className={primario}>
          Ir al panel
          <ArrowRight size={16} aria-hidden />
        </Link>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={secundario}
        >
          <MessageCircle size={16} aria-hidden />
          Escribir por WhatsApp
        </a>
      </div>
    );
  }

  if (esAutenticado && tieneNegocio) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={primario}
        >
          <MessageCircle size={16} aria-hidden />
          Contratar por WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className={primario}
      >
        <MessageCircle size={16} aria-hidden />
        Preguntar por WhatsApp
      </a>
      {!esAutenticado && (
        <Link href="/sign-in" className={secundario}>
          Iniciar sesión
        </Link>
      )}
    </div>
  );
}
