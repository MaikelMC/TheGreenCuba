"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIAS_SEMANA,
  DIA_SEMANA_LABEL,
  type DiaSemana,
  type Franja,
  type Horario,
} from "@/lib/ficha/horario";
import { Input } from "@/components/ui/input";

const VACIA: Franja = { abre: "08:00", cierra: "18:00" };

const TOGGLE =
  "grid size-5 place-items-center rounded-sm border-2 cursor-pointer transition-colors duration-300 ease-outquint";

/**
 * Editor de horario estructurado, día por día.
 *
 * Cada día puede tener cero o más franjas horarias. Sin franjas, ese día está
 * cerrado. Una franja que cruza medianoche se guarda con `cierra <= abre`
 * (p. ej. `22:00`–`02:00`); el módulo `horario.ts` lo entiende.
 *
 * No incluye excepciones por fecha: eso va en la Fase 4 completa.
 */
export function HorarioEditor({
  value,
  onChange,
}: {
  value: Horario | null;
  onChange: (next: Horario | null) => void;
}) {
  const semana = value?.semana ?? {};

  function setFranjas(dia: DiaSemana, franjas: Franja[]) {
    const nueva: Horario = {
      semana: { ...semana, [dia]: franjas },
      excepciones: value?.excepciones ?? [],
    };
    /* Si todos los días quedan sin franjas, se guarda null: no hay horario. */
    const alguno = Object.values(nueva.semana).some((f) => f && f.length > 0);
    onChange(alguno ? nueva : null);
  }

  function toggleDia(dia: DiaSemana) {
    const actual = semana[dia] ?? [];
    setFranjas(dia, actual.length > 0 ? [] : [{ ...VACIA }]);
  }

  function addFranja(dia: DiaSemana) {
    const actual = semana[dia] ?? [];
    const ultima = actual[actual.length - 1];
    setFranjas(dia, [...actual, { ...(ultima ?? VACIA) }]);
  }

  function updateFranja(
    dia: DiaSemana,
    idx: number,
    campo: keyof Franja,
    val: string,
  ) {
    const actual = semana[dia] ?? [];
    const nueva = actual.map((f, i) => (i === idx ? { ...f, [campo]: val } : f));
    setFranjas(dia, nueva);
  }

  function removeFranja(dia: DiaSemana, idx: number) {
    const actual = semana[dia] ?? [];
    setFranjas(dia, actual.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-gap-sm">
      {DIAS_SEMANA.map((dia) => {
        const franjas = semana[dia] ?? [];
        const abierto = franjas.length > 0;

        return (
          <div key={dia} className="rounded-xl border border-ink/8 bg-white p-gap-sm">
            <div className="flex items-center gap-gap-sm">
              <button
                type="button"
                aria-label={`${abierto ? "Cerrar" : "Abrir"} ${DIA_SEMANA_LABEL[dia]}`}
                onClick={() => toggleDia(dia)}
                className={cn(
                  TOGGLE,
                  abierto
                    ? "border-verde-500 bg-verde-500 text-white"
                    : "border-ink/20 bg-white",
                )}
              >
                {abierto && (
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    className="size-3"
                    aria-hidden
                  >
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>

              <span className="min-w-[6ch] font-lv-display text-small font-semibold text-ink">
                {DIA_SEMANA_LABEL[dia]}
              </span>

              {!abierto && (
                <span className="text-meta text-ink-soft/50">Cerrado</span>
              )}

              {abierto && franjas.length < 3 && (
                <button
                  type="button"
                  onClick={() => addFranja(dia)}
                  className="ml-auto inline-flex h-7 cursor-pointer items-center gap-[4px] rounded-full border border-ink/10 bg-sand px-gap-sm font-lv-display text-meta text-ink-soft/70 transition-colors hover:border-verde-300 hover:text-verde-600"
                >
                  <Plus size={13} strokeWidth={2} />
                  Franja
                </button>
              )}
            </div>

            {abierto && (
              <div className="mt-gap-xs flex flex-col gap-[6px]">
                {franjas.map((franja, idx) => (
                  <div key={idx} className="flex items-center gap-[6px]">
                    <Input
                      type="time"
                      value={franja.abre}
                      onChange={(e) =>
                        updateFranja(dia, idx, "abre", e.target.value)
                      }
                      className="h-8 rounded-lg border-ink/10 bg-sand px-2 text-small"
                    />
                    <span className="shrink-0 text-meta text-ink-soft/50">–</span>
                    <Input
                      type="time"
                      value={franja.cierra}
                      onChange={(e) =>
                        updateFranja(dia, idx, "cierra", e.target.value)
                      }
                      className="h-8 rounded-lg border-ink/10 bg-sand px-2 text-small"
                    />
                    {franjas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFranja(dia, idx)}
                        aria-label="Quitar franja"
                        className="grid size-7 cursor-pointer place-items-center rounded-lg text-ink-soft/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={14} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
