"use client";

import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FEATURES_POR_PLAN,
  FEATURE_TEXTO,
  PLAN_LABEL,
  incluye,
  textoBloqueo,
  type Feature,
  type Plan,
} from "@/lib/plans";

/**
 * Qué incluye el plan del negocio, con candado en lo que no.
 *
 * **Las funciones que no entran se enseñan igual**, bloqueadas y con el plan
 * que las abre. Esconderlas no vendería nada: esta tarjeta es la lista de lo
 * que hay, y el candado es el argumento de venta.
 *
 * El orden de la lista es el del catálogo —gratis, luego básico, luego pro—,
 * así que los candados quedan agrupados solos al final sin necesidad de
 * separarlos por secciones.
 */
export function PlanCard({ plan }: { plan: Plan }) {
  /* Del plan más alto al más bajo está **toda** la lista, en orden. */
  const catalogo = FEATURES_POR_PLAN.pro as readonly Feature[];

  return (
    <section className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft lg:col-span-2">
      <div className="flex flex-wrap items-center gap-gap-sm">
        <h2 className="font-lv-display text-body font-semibold text-ink">
          Tu plan
        </h2>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-[10px] py-[3px] font-lv-display text-[11px] font-semibold uppercase tracking-[0.12em]",
            plan === "gratis"
              ? "border border-ink/10 bg-sand text-ink-soft/75"
              : "border border-verde-200 bg-verde-50 text-verde-700",
          )}
        >
          {PLAN_LABEL[plan]}
        </span>
      </div>

      {plan === "gratis" && (
        <p className="mt-gap-xs max-w-[60ch] text-small text-ink-soft/75">
          Tu negocio entra gratis. Lo que está bajo candado se abre con los
          planes de pago — nada de lo que ya tienes se pierde.
        </p>
      )}

      <ul className="mt-gap-md grid grid-cols-1 gap-gap-xs lg:grid-cols-2">
        {catalogo.map((feature) => {
          const dentro = incluye(plan, feature);
          const bloqueo = textoBloqueo(feature, plan);

          return (
            <li
              key={feature}
              className={cn(
                "flex items-start gap-gap-xs text-small",
                dentro ? "text-ink" : "text-ink-soft/75",
              )}
            >
              {dentro ? (
                <Check
                  size={15}
                  strokeWidth={2}
                  className="mt-[3px] shrink-0 text-verde-600"
                />
              ) : (
                <Lock
                  size={14}
                  strokeWidth={1.8}
                  className="mt-[3px] shrink-0 text-ink-soft/75"
                />
              )}
              <span className="text-pretty">
                {FEATURE_TEXTO[feature]}
                {bloqueo && (
                  <span className="ml-gap-xs whitespace-nowrap font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft/75">
                    {bloqueo}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
