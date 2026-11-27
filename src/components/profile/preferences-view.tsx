"use client";

import type { UserPreferences } from "@/lib/user-preferences-store";
import { PreferenceSections } from "@/components/profile/details-view";

/**
 * «Preferencias»: lo que personaliza el descubrimiento.
 *
 * Antes vivía dentro de «Sobre mí», debajo de la actividad, y se leía como parte
 * de las métricas. Son dos cosas distintas: esto se elige y se guarda con el
 * botón de la cabecera; la actividad solo se consulta. Los chips son los mismos
 * de siempre y guardan en el mismo sitio (`POST /api/me`).
 */
export function PreferencesView({
  prefs,
  toggle,
}: {
  prefs: UserPreferences;
  toggle: (
    listKey: "interests" | "moods" | "currencies",
    value: string,
  ) => void;
}) {
  return (
    <div className="flex flex-col gap-gap-lg">
      <p className="rounded-2xl border border-verde-200 bg-verde-50 px-gap-sm py-gap-xs text-meta leading-relaxed text-verde-700">
        Elige lo que te gusta para que el mapa y las recomendaciones se ajusten a
        ti. Los cambios se guardan con <strong className="font-semibold">Guardar</strong>,
        arriba a la derecha.
      </p>
      <PreferenceSections prefs={prefs} toggle={toggle} />
    </div>
  );
}
