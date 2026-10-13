"use client";

import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { lemaDe, nombreDe, type Funcion, type Plan } from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";

/** Cuántas funciones de la lista se enseñan. Las demás se cuentan. */
const VISIBLES = 6;

/**
 * El plan del negocio, en el dashboard.
 *
 * **Solo lo suyo.** Antes esta tarjeta enseñaba el catálogo entero con candado
 * sobre lo que no entraba, y el resultado era una lista de veinte líneas donde
 * lo que el negocio ya tiene se perdía entre cerraduras: entraba a mirar su plan
 * y se encontraba un catálogo. Ahora enseña lo que tiene —que es la pregunta que
 * trae— y el resto vive en la sección «Planes», con sitio para explicarse.
 *
 * Lo que enseña son los **extras sobre Gratis**, no las funciones del pack por
 * su nombre: con módulos sueltos, un negocio en Gratis puede tener funciones que
 * ningún pack nombra, y un negocio con pack puede no tenerlas. La lista sale de
 * lo resuelto, que es lo único que dice la verdad.
 *
 * La tarjeta se tiñe cuando tiene algo de pago. Es el mismo gesto que el sello
 * verde de la cabecera, y separa de un vistazo quien está pagando de quien no.
 */
export function PlanCard({
  plan,
  funciones,
  onVerPlanes,
}: {
  plan: Plan;
  /** Las funciones que el negocio tiene resueltas, del servidor. */
  funciones: readonly Funcion[];
  /** Lleva a la sección «Planes». La vista la cambia el armazón del panel. */
  onVerPlanes: () => void;
}) {
  const cat = useCatalogo();
  const extras = funciones.filter((f) => !cat.gratis.includes(f));
  /* Sin extras —Gratis pelado— se enseña lo de Gratis, que si no la tarjeta sale
     vacía justo para el que menos sabe qué tiene. */
  const lista = extras.length > 0 ? extras : cat.gratis;
  /* Se cortan a las primeras: Pro acumula veinte funciones y la lista entera era
     un catálogo, justo lo que esta tarjeta dejó de hacer. */
  const visibles = lista.slice(0, VISIBLES);
  const ocultas = lista.length - visibles.length;
  const dePago = extras.length > 0;

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
        {visibles.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-gap-xs text-small text-ink"
          >
            <Check
              size={15}
              strokeWidth={2}
              className="mt-[3px] shrink-0 text-verde-600"
            />
            <span className="text-pretty">{cat.funciones[feature].texto}</span>
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
        {ocultas > 0 ? (
          <p className="text-meta text-ink-soft/75">
            Y {ocultas} {ocultas === 1 ? "función más" : "funciones más"}.
          </p>
        ) : extras.length === 0 ? (
          <p className="text-meta text-ink-soft/75">
            Los planes y módulos añaden más funciones.
          </p>
        ) : null}
      </div>
    </section>
  );
}
