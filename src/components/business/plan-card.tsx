"use client";

import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { lemaDe, nombreDe, type ClaveModulo, type Plan } from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";

/** Cuántos puntos de la lista se enseñan. Los demás se cuentan. */
const VISIBLES = 6;

/** Un `texto` del catálogo partido en puntos: una línea por punto, sin vacíos. */
function lineas(texto: string): string[] {
  return texto
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);
}

/**
 * El plan del negocio, en el dashboard.
 *
 * **Solo lo suyo, y con las palabras del catálogo.** Enseña los puntos del pack
 * —los mismos que la sección «Planes»— y, si además contrata módulos sueltos,
 * los de esos módulos. Antes volcaba las funciones resueltas una a una con su
 * texto suelto, y el resultado no se parecía a lo que el negocio había comprado:
 * «qr_sin_marca» donde la tarjeta de al lado dice «Menú Pro», y el asistente de
 * Telegram —lo que distingue a Pro— cayendo el décimo, fuera de la lista.
 *
 * Sin pack enseña lo de Gratis, que es lo que tiene justo quien menos sabe qué
 * tiene. Y como un negocio en Gratis puede tener módulos que «Gratis» no nombra,
 * la lista no sale del plan sino del catálogo: lo que se paga se cuenta.
 *
 * La tarjeta se tiñe cuando tiene algo de pago. Es el mismo gesto que el sello
 * verde de la cabecera, y separa de un vistazo quien está pagando de quien no.
 */
export function PlanCard({
  plan,
  modulos,
  onVerPlanes,
}: {
  plan: Plan;
  /** Los módulos sueltos vigentes del negocio, resueltos en el servidor. */
  modulos: readonly ClaveModulo[];
  /** Lleva a la sección «Planes». La vista la cambia el armazón del panel. */
  onVerPlanes: () => void;
}) {
  const cat = useCatalogo();
  const dePago = plan !== "gratis" || modulos.length > 0;
  const puntos = [
    ...(plan === "gratis"
      ? cat.gratis.map((f) => cat.funciones[f].texto)
      : lineas(cat.packs[plan].texto)),
    ...modulos.flatMap((m) => lineas(cat.modulos[m].texto)),
  ];
  /* Se cortan a los primeros: dos módulos sueltos ya suman ocho puntos y la
     lista entera era un catálogo, justo lo que esta tarjeta dejó de hacer. */
  const visibles = puntos.slice(0, VISIBLES);
  const ocultos = puntos.length - visibles.length;

  return (
    <section
      className={cn(
        "rounded-2xl border p-gap-md lg:col-span-2",
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
          {nombreDe(plan, cat)}
        </span>
      </div>

      <p className="mt-gap-sm font-lv-display text-h3 font-bold tracking-[-0.01em] text-ink">
        {nombreDe(plan, cat)}
      </p>
      <p className="mt-gap-2xs max-w-[52ch] text-small text-ink-soft/75">
        {lemaDe(plan, cat)}
      </p>

      <ul className="mt-gap-md grid grid-cols-1 gap-gap-xs lg:grid-cols-2">
        {visibles.map((punto, i) => (
          <li
            key={`${i}-${punto}`}
            className="flex items-start gap-gap-xs text-small text-ink"
          >
            <Check
              size={15}
              strokeWidth={2}
              className="mt-[3px] shrink-0 text-verde-600"
            />
            <span className="text-pretty">{punto}</span>
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
        {ocultos > 0 ? (
          <p className="text-meta text-ink-soft/75">Y {ocultos} más.</p>
        ) : !dePago ? (
          <p className="text-meta text-ink-soft/75">
            Los planes y servicios suman más.
          </p>
        ) : null}
      </div>
    </section>
  );
}
