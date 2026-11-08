"use client";

import { WifiOff, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface NecesitaConexionProps {
  /** Texto principal. Por defecto: «Necesita conexión». */
  titulo?: string;
  /** Línea de apoyo. Por defecto: «Esta sección requiere acceso a internet». */
  descripcion?: string;
  /** Muestra el botón «Volver». Por defecto: true. */
  conBotonVolver?: boolean;
  className?: string;
}

/**
 * Pantalla de placeholder para rutas que no funcionan sin red.
 *
 * Se usa en /projects, /enlaces y cualquier ruta que el SW no pueda servir
 * offline. El botón «Volver» usa `history.back()` en vez de un Link para no
 * generar una navegación SPA que falle también.
 */
export function NecesitaConexion({
  titulo = "Necesita conexión",
  descripcion = "Esta sección requiere acceso a internet.",
  conBotonVolver = true,
  className,
}: NecesitaConexionProps) {
  return (
    <div
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid size-14 place-items-center rounded-2xl bg-sand-deep text-ink-soft/60"
      >
        <WifiOff size={26} strokeWidth={1.6} />
      </span>

      <div className="flex flex-col gap-1">
        <h2 className="font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink">
          {titulo}
        </h2>
        <p
          className="max-w-[32ch] text-small leading-relaxed text-ink-soft/70 text-pretty"
          aria-describedby="necesita-conexion-desc"
          id="necesita-conexion-desc"
        >
          {descripcion}
        </p>
      </div>

      {conBotonVolver && (
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/15 px-5 font-lv-display text-small font-semibold text-ink transition-colors duration-500 hover:border-ink/30 hover:bg-sand"
        >
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
          Volver
        </button>
      )}
    </div>
  );
}
