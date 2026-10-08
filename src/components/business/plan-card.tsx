"use client";

import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FEATURES_POR_PLAN,
  FEATURE_TEXTO,
  PLAN_LABEL,
  PLAN_LEMA,
  type Feature,
  type Plan,
} from "@/lib/plans";

/**
 * El plan del negocio, en el dashboard.
 *
 * **Solo el suyo.** Antes esta tarjeta enseñaba el catálogo entero con candado
 * sobre lo que no entraba, y el resultado era una lista de veinte líneas donde
 * lo que el negocio ya tiene se perdía entre cerraduras: entraba a mirar su plan
 * y se encontraba un catálogo. Ahora enseña lo que tiene —que es la pregunta que
 * trae— y el resto vive en la sección «Planes», con sitio para explicarse.
 *
 * La tarjeta se tiñe cuando el plan es de pago. Es el mismo gesto que el sello
 * verde de la cabecera, y separa de un vistazo quien está pagando de quien no.
 */
export function PlanCard({
  plan,
  onVerPlanes,
}: {
  plan: Plan;
  /** Lleva a la sección «Planes». La vista la cambia el armazón del panel. */
  onVerPlanes: () => void;
}) {
  const funciones = FEATURES_POR_PLAN[plan] as readonly Feature[];
  /* Lo que se queda fuera. Sale del catálogo más alto y no de sumar los otros
     dos: sumar listas se descompone el día que una función cambie de plan. */
  const restantes = FEATURES_POR_PLAN.pro.length - funciones.length;
  const dePago = plan !== "gratis";

  return (
    <section
      className={cn(
        "rounded-2xl border p-gap-md shadow-soft lg:col-span-2",
        dePago ? "border-verde-200 bg-verde-50/60" : "border-ink/5 bg-white",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-gap-sm">
        <h2 className="font-lv-display text-body font-semibold text-ink">
          Tu plan
        </h2>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-[10px] py-[3px] font-lv-display text-[11px] font-semibold uppercase tracking-[0.12em]",
            dePago
              ? "border border-verde-200 bg-white text-verde-700"
              : "border border-ink/10 bg-sand text-ink-soft/75",
          )}
        >
          {PLAN_LABEL[plan]}
        </span>
      </div>

      <p className="mt-gap-sm font-lv-display text-h3 font-bold tracking-[-0.01em] text-ink">
        {PLAN_LABEL[plan]}
      </p>
      <p className="mt-gap-2xs max-w-[52ch] text-small text-ink-soft/75">
        {PLAN_LEMA[plan]}
      </p>

      <ul className="mt-gap-md grid grid-cols-1 gap-gap-xs lg:grid-cols-2">
        {funciones.map((feature) => (
          <li key={feature} className="flex items-start gap-gap-xs text-small text-ink">
            <Check
              size={15}
              strokeWidth={2}
              className="mt-[3px] shrink-0 text-verde-600"
            />
            <span className="text-pretty">{FEATURE_TEXTO[feature]}</span>
          </li>
        ))}
      </ul>

      <div className="mt-gap-md flex flex-wrap items-center gap-gap-sm">
        <button
          type="button"
          onClick={onVerPlanes}
          className="inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
        >
          Ver todos los planes
          <ArrowRight size={16} strokeWidth={1.8} />
        </button>
        {restantes > 0 && (
          <p className="text-meta text-ink-soft/75">
            Los planes de pago añaden {restantes} funciones más.
          </p>
        )}
      </div>
    </section>
  );
}
