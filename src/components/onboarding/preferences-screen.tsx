"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { StatusBar } from "./onboarding-shell";

interface PreferencesScreenProps {
  locationName: string;
  interests: Array<{ value: string; label: string }>;
  moods: Array<{ value: string; label: string }>;
  currencies: Array<{ value: string; label: string }>;
  onBack: () => void;
  onResetAI: () => void;
  onDone: () => void;
}

export function PreferencesScreen({
  locationName,
  interests,
  moods,
  currencies,
  onBack,
  onResetAI,
  onDone,
}: PreferencesScreenProps) {
  const [editing, setEditing] = useState(false);
  const [toggles, setToggles] = useState({
    notifRecomendaciones: true,
    notifOfertas: true,
    notifFavoritos: false,
    iaLearning: true,
    iaPersonal: true,
  });
  const [exactLocation, setExactLocation] = useState(false);

  function toggle(key: keyof typeof toggles) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="flex flex-col h-full">
      <StatusBar />

      <div className="flex items-center gap-3 px-5 py-4 border-b border-ink/5 flex-shrink-0 min-h-[56px]">
        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.9 }}
          className="size-10 rounded-full flex items-center justify-center text-ink hover:bg-verde-50 transition-colors duration-500"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </motion.button>
        <h1 className="flex-1 font-lv-display text-h3 font-bold text-ink">Mis Preferencias</h1>
        <button
          onClick={() => setEditing((e) => !e)}
          className={cn(
            "bg-none px-2 py-2 min-h-[40px] text-small font-semibold rounded-full transition-colors duration-500",
            editing ? "text-verde-700" : "text-verde-600 hover:text-verde-700",
          )}
        >
          {editing ? "Listo" : "Editar"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 pb-20 scrollbar-hide">
        {/* Ubicación */}
        <section className="mb-8">
          <h2 className="font-lv-display text-[10px] font-semibold text-verde-600 mb-3 uppercase tracking-[0.22em]">
            Ubicación
          </h2>
          <div className="flex items-center justify-between py-3 border-b border-ink/5">
            <span className="text-body font-medium text-ink">Ciudad principal</span>
            <span className="font-lv-display text-small text-ink-soft/75 flex items-center gap-1.5">
              {locationName}
            </span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-ink/5 last:border-none">
            <span className="text-body font-medium text-ink">Usar ubicación exacta</span>
            <ToggleSwitch active={exactLocation} onToggle={() => setExactLocation((v) => !v)} />
          </div>
        </section>

        {/* Intereses */}
        <section className="mb-8">
          <h2 className="font-lv-display text-[10px] font-semibold text-verde-600 mb-3 uppercase tracking-[0.22em]">
            Intereses
          </h2>
          <div className="flex items-center justify-between py-3 border-b border-ink/5">
            <span className="text-body font-medium text-ink shrink-0">Categorías favoritas</span>
            <span className="flex flex-wrap justify-end gap-1.5 min-w-0">
              {interests.map((i) => (
                <span key={i.value} className="px-2.5 py-1 rounded-full bg-verde-50 text-verde-600 font-lv-display text-xs font-semibold">
                  {i.label}
                </span>
              ))}
            </span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-ink/5 last:border-none">
            <span className="text-body font-medium text-ink shrink-0">Ambiente preferido</span>
            <span className="flex flex-wrap justify-end gap-1.5 min-w-0">
              {moods.map((m) => (
                <span key={m.value} className="px-2.5 py-1 rounded-full bg-verde-50 text-verde-600 font-lv-display text-xs font-semibold">
                  {m.label}
                </span>
              ))}
            </span>
          </div>
        </section>

        {/* Monedas */}
        <section className="mb-8">
          <h2 className="font-lv-display text-[10px] font-semibold text-verde-600 mb-3 uppercase tracking-[0.22em]">
            Monedas
          </h2>
          <div className="flex items-center justify-between py-3 border-b border-ink/5 last:border-none">
            <span className="text-body font-medium text-ink shrink-0">Mis monedas</span>
            <span className="flex flex-wrap justify-end gap-1.5 min-w-0">
              {currencies.map((c) => (
                <span key={c.value} className="px-2.5 py-1 rounded-full bg-verde-50 text-verde-600 font-lv-display text-xs font-semibold">
                  {c.label}
                </span>
              ))}
            </span>
          </div>
        </section>

        {/* Notificaciones */}
        <section className="mb-8">
          <h2 className="font-lv-display text-[10px] font-semibold text-verde-600 mb-3 uppercase tracking-[0.22em]">
            Notificaciones
          </h2>
          <div className="flex items-center justify-between py-3 border-b border-ink/5">
            <span className="text-body font-medium text-ink">Recomendaciones de nuevos lugares</span>
            <ToggleSwitch active={toggles.notifRecomendaciones} onToggle={() => toggle("notifRecomendaciones")} />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-ink/5">
            <span className="text-body font-medium text-ink">Ofertas cerca de mí</span>
            <ToggleSwitch active={toggles.notifOfertas} onToggle={() => toggle("notifOfertas")} />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-ink/5 last:border-none">
            <span className="text-body font-medium text-ink">Ofertas en mis lugares favoritos</span>
            <ToggleSwitch active={toggles.notifFavoritos} onToggle={() => toggle("notifFavoritos")} />
          </div>
        </section>

        {/* Tu IA */}
        <section className="mb-8">
          <h2 className="font-lv-display text-[10px] font-semibold text-verde-600 mb-3 uppercase tracking-[0.22em]">
            Tu IA
          </h2>
          <div className="flex items-center justify-between py-3 border-b border-ink/5">
            <span className="text-body font-medium text-ink">La IA aprende de tus visitas</span>
            <ToggleSwitch active={toggles.iaLearning} onToggle={() => toggle("iaLearning")} />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-ink/5">
            <span className="text-body font-medium text-ink">Recomendaciones personalizadas</span>
            <ToggleSwitch active={toggles.iaPersonal} onToggle={() => toggle("iaPersonal")} />
          </div>
          <div className="py-3 border-none">
            <span className="text-meta text-ink-soft/75 block">
              La IA mejora con cada interacción. Puedes resetear tu perfil cuando quieras.
            </span>
          </div>
        </section>

        {/* Datos */}
        <section className="mb-8">
          <h2 className="font-lv-display text-[10px] font-semibold text-verde-600 mb-3 uppercase tracking-[0.22em]">
            Datos
          </h2>
          <div className="flex items-center justify-between py-3 border-none">
            <span className="text-body font-medium text-destructive">Resetear perfil de IA</span>
            <motion.button
              onClick={onResetAI}
              whileTap={{ scale: 0.95 }}
              className="px-3.5 py-1.5 min-h-[36px] border border-destructive text-destructive rounded-full text-xs font-medium transition-colors duration-500 hover:bg-destructive/10"
            >
              Resetear
            </motion.button>
          </div>
        </section>
      </div>

      <div className="px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 flex-shrink-0 bg-gradient-to-t from-sand-warm via-sand-warm to-transparent">
        <motion.button
          onClick={onDone}
          whileTap={{ scale: 0.98 }}
          className="inline-flex w-full items-center justify-center gap-2 px-6 py-3 rounded-full font-lv-display text-sm font-semibold bg-verde-400 text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint min-h-12 hover:bg-verde-300 active:scale-[0.98]"
        >
          Empezar a explorar
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}

function ToggleSwitch({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.94 }}
      role="switch"
      aria-checked={active}
      className={cn(
        "w-11 h-[26px] rounded-full relative transition-colors duration-500 ease-outquint flex-shrink-0",
        active ? "bg-verde-400" : "bg-ink/10",
      )}
    >
      <motion.span
        animate={{ x: active ? 18 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="size-[22px] rounded-full bg-white absolute top-[2px] left-[2px] shadow-[0_1px_4px_rgba(8,19,13,0.15)]"
      />
    </motion.button>
  );
}
