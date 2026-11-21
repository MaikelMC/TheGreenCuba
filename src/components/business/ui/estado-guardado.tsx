"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";

/**
 * El estado del guardado automático de una tarjeta: «Guardando…» y luego
 * «Guardado ✓» unos segundos. Va en `role="status"` para que un lector de
 * pantalla lo anuncie sin mover el foco.
 *
 * Es el sustituto de los botones «Guardar tasa», «Guardar reservas»…: los
 * interruptores y selectores guardan al cambiar, y los campos de texto y número
 * al salir del campo (nunca mientras se escribe).
 */
export type EstadoGuardado = "quieto" | "guardando" | "guardado";

export function useEstadoGuardado() {
  const [estado, setEstado] = useState<EstadoGuardado>("quieto");
  const temporizador = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current) window.clearTimeout(temporizador.current);
    },
    [],
  );

  /** Corre el guardado y pinta su estado. Devuelve si salió bien. */
  const guardar = useCallback(async (fn: () => Promise<boolean>): Promise<boolean> => {
    if (temporizador.current) window.clearTimeout(temporizador.current);
    setEstado("guardando");
    const ok = await fn();
    if (!ok) {
      setEstado("quieto");
      return false;
    }
    setEstado("guardado");
    temporizador.current = window.setTimeout(() => setEstado("quieto"), 2500);
    return true;
  }, []);

  return { estado, guardar };
}

export function AvisoGuardado({ estado }: { estado: EstadoGuardado }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex min-h-[20px] items-center gap-[5px] font-lv-display text-meta font-semibold text-ink-soft/75"
    >
      {estado === "guardando" && (
        <>
          <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
          Guardando…
        </>
      )}
      {estado === "guardado" && (
        <>
          <Check size={14} strokeWidth={2.2} className="text-verde-600" />
          Guardado
        </>
      )}
    </span>
  );
}
