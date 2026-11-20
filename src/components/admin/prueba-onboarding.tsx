"use client";

import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { STORAGE_KEY, clearUserPreferences } from "@/lib/user-preferences-store";

/**
 * Borra las preferencias de este navegador.
 *
 * Con `clearUserPreferences()` se van la clave recordada, la genérica y la de
 * invitado; el barrido por prefijo se lleva además las de otras cuentas que
 * hayan quedado en el navegador. Hace falta limpiarlas y no solo reiniciar la
 * fila de la base: `mergeRemoteUserPreferences` conserva los intereses y las
 * monedas locales, así que sin esto el onboarding abriría con las respuestas de
 * la prueba anterior ya marcadas.
 */
function limpiarPreferenciasLocales(): void {
  try {
    clearUserPreferences();
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(`${STORAGE_KEY}:`)) window.localStorage.removeItem(key);
    }
  } catch {
    /* localStorage bloqueado: con el reinicio del servidor ya se puede recorrer
       el flujo; lo único que se pierde es ver las pantallas sin premarcar. */
  }
}

/**
 * Botón de arranque de la prueba del onboarding.
 *
 * Primero reinicia en el servidor y después limpia el navegador. En ese orden a
 * propósito: si el `POST` falla no se toca nada local y se puede reintentar sin
 * quedarse con el estado a medias.
 */
export function PruebaOnboarding() {
  const [reiniciando, setReiniciando] = useState(false);

  async function reiniciar() {
    setReiniciando(true);
    try {
      const response = await fetch("/api/admin/prueba-onboarding", {
        method: "POST",
      });
      if (!response.ok) throw new Error(String(response.status));

      limpiarPreferenciasLocales();

      /* Recarga completa y no `router.push`: el onboarding decide al montar, con
         `/api/me`, si le toca pintarse, y así no queda nada cacheado del paso
         anterior. */
      window.location.assign("/onboarding");
    } catch {
      setReiniciando(false);
      toast.error("No se pudo reiniciar el onboarding. Inténtalo de nuevo.");
    }
  }

  return (
    <div className="mt-gap-md">
      <button
        type="button"
        onClick={reiniciar}
        disabled={reiniciando}
        className="inline-flex items-center gap-gap-xs h-11 px-gap-lg rounded-full bg-verde-600 text-white text-small font-semibold hover:bg-verde-700 transition-colors duration-300 disabled:opacity-50"
      >
        {reiniciando ? (
          <Loader2 size={17} strokeWidth={1.8} className="animate-spin" />
        ) : (
          <RotateCcw size={17} strokeWidth={1.8} />
        )}
        {reiniciando ? "Reiniciando…" : "Empezar desde el inicio"}
      </button>
      <p className="text-meta text-ink-soft/75 mt-gap-xs">
        Abre el onboarding en su primera pantalla. Al terminar, vuelve a esta
        página para repetir la prueba.
      </p>
    </div>
  );
}
