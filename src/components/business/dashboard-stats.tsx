"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";

interface StatChange {
  value: string;
  direction: "up" | "down" | "neutral";
}

interface StatCard {
  label: string;
  value: string;
  /**
   * La variación respecto al periodo anterior. **Opcional desde que las
   * tarjetas llevan cifras de verdad**: para contar cuántos guardados tienes
   * hoy hace falta la tabla `saved_places`, y para decir cuántos tenías la
   * semana pasada haría falta un histórico que no existe. Antes era obligatoria
   * y por eso el panel de negocio enseñaba un «+18%» que nadie había medido: lo
   * más fácil era inventarlo. Sin dato, no se pinta la pastilla.
   *
   * Sigue siendo opcional y no se borra porque el panel de administración sí la
   * pasa, con cifras derivadas de las suyas —«4 activos», «12% del total»—.
   */
  change?: StatChange;
  /** Una línea de apoyo bajo la cifra, sin pastilla. */
  hint?: string;
  /**
   * La tarjeta entera se apaga. Para una métrica que el plan no incluye: se
   * sigue leyendo qué es, pero no compite con las cifras que sí importan.
   */
  dimmed?: boolean;
}

interface DashboardStatsProps {
  stats: StatCard[];
  className?: string;
}

/* Subir es buena noticia, así que va en verde del sistema. Bajar no es un
   error del negocio, solo una caída: por eso el tinte apagado de arena y no
   el rojo de destructivo, que aquí alarmaría de más. */
const changeStyles: Record<string, string> = {
  up: "text-verde-600 bg-verde-50",
  down: "text-ink-soft/75 bg-sand-deep",
  neutral: "text-ink-soft/75 bg-sand-deep",
};

const changeIcons: Record<StatChange["direction"], LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

export function DashboardStats({ stats, className }: DashboardStatsProps) {
  return (
    <div
      className={cn("grid grid-cols-2 lg:grid-cols-4 gap-gap-sm", className)}
    >
      {stats.map((s, i) => {
        const change = s.change;
        const Icon = change ? (changeIcons[change.direction] ?? Minus) : Minus;
        return (
          <motion.div
            key={s.label}
            /* `false` y no `{ opacity: 0 }`: con `initial`, el HTML del
               servidor salía con las tarjetas invisibles hasta que hidrataba
               el JavaScript, y en una conexión lenta la sección parecía vacía. */
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: i * 0.06,
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
            }}
            /* Sin `whileHover` ni `hover:shadow-card`: no hay nada que hacer al
               pasar por encima de una cifra, y una tarjeta que se levanta sin
               motivo promete una interacción que no existe. */
            aria-disabled={s.dimmed || undefined}
            className={cn(
              "bg-white border border-ink/5 rounded-2xl p-gap-md flex flex-col gap-gap-xs",
              s.dimmed && "opacity-50",
            )}
          >
            {/* El interletrado era de 0,22em y la etiqueta se partía en dos
                líneas en cuanto pasaba de doce letras —«Llamadas · 30 días» en
                media pantalla de móvil—, así que las tarjetas de una misma fila
                acababan con alturas distintas. A 0,06em entra entera. */}
            <span className="font-lv-display text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-verde-600">
              {s.label}
            </span>
            {/* Escala fija, no `clamp`: la misma cifra medía distinto en la
                rejilla de dos columnas del móvil y en la de cuatro de
                escritorio, así que encogía con la ventana en vez de con la
                jerarquía. `text-h3` es además la escala que ya usan las filas de
                cifras del panel, y `tabular-nums` evita que el número baile. */}
            <span className="font-lv-display text-h3 font-bold tabular-nums text-ink">
              {s.value}
            </span>
            {s.hint && (
              <span className="text-meta leading-snug text-ink-soft/70">
                {s.hint}
              </span>
            )}
            {change && (
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-[4px] rounded-full px-[8px] py-[3px] font-lv-display text-meta font-medium",
                  changeStyles[change.direction],
                )}
              >
                <Icon size={12} strokeWidth={1.8} />
                {change.value}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
