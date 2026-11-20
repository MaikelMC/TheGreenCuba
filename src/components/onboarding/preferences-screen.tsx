"use client";

import { motion } from "motion/react";

interface PreferencesScreenProps {
  locationName: string;
  interests: Array<{ value: string; label: string }>;
  moods: Array<{ value: string; label: string }>;
  currencies: Array<{ value: string; label: string }>;
  onBack: () => void;
  onDone: () => void;
}

/**
 * Resumen final del onboarding de usuario: lo elegido, y nada más.
 *
 * Aquí había interruptores de notificaciones, IA y «ubicación exacta» que
 * vivían en un `useState` y no se guardaban en ningún sitio: el usuario apagaba
 * algo y no pasaba nada. Se quitaron. Si algún día existen de verdad, vuelven
 * conectados a su guardado.
 */
export function PreferencesScreen({
  locationName,
  interests,
  moods,
  currencies,
  onBack,
  onDone,
}: PreferencesScreenProps) {
  const rows = [
    { label: "Ciudad", values: [{ value: "city", label: locationName }] },
    { label: "Lugares", values: interests },
    { label: "Ambiente", values: moods },
    { label: "Monedas", values: currencies },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 pb-3 pt-[max(12px,env(safe-area-inset-top))] border-b border-ink/5 flex-shrink-0">
        <motion.button
          type="button"
          onClick={onBack}
          whileTap={{ scale: 0.9 }}
          aria-label="Volver a los pasos"
          className="size-11 rounded-full flex items-center justify-center text-ink hover:bg-verde-50 transition-colors duration-500"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </motion.button>
        <h1 className="flex-1 font-lv-display text-h3 font-bold text-ink">Tus preferencias</h1>
      </div>

      <dl className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-2 scrollbar-hide">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-gap-md py-4 border-b border-ink/5 last:border-none"
          >
            <dt className="text-body font-medium text-ink shrink-0">{row.label}</dt>
            <dd className="flex flex-wrap justify-end gap-1.5 min-w-0">
              {row.values.length > 0 ? (
                row.values.map((v) => (
                  <span key={v.value} className="px-2.5 py-1 rounded-full bg-verde-50 text-verde-700 font-lv-display text-meta font-semibold">
                    {v.label}
                  </span>
                ))
              ) : (
                <span className="text-small text-ink-soft/75">Sin elegir</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 flex-shrink-0 bg-gradient-to-t from-sand-warm via-sand-warm to-transparent">
        <motion.button
          type="button"
          onClick={onDone}
          whileTap={{ scale: 0.98 }}
          className="inline-flex w-full items-center justify-center gap-2 px-6 py-3 rounded-full font-lv-display text-sm font-semibold bg-verde-400 text-verde-950 shadow-primary-halo transition duration-500 ease-outquint min-h-12 hover:bg-verde-300 active:scale-[0.98]"
        >
          Empezar a explorar
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
