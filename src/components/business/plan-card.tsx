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
    <section>
      <div className="mb-gap-sm">
        <h2 className="font-lv-display text-body font-semibold text-ink">
          Tu plan
        </h2>
        <p className="mt-[3px] text-small text-ink-soft/70">
          Los servicios que tienes activos para tu negocio.
        </p>
      </div>

      {/* La tarjeta del rediseño: degradado verde muy claro, halo en la esquina
          y la lista de beneficios en dos columnas. Sin pago se queda en blanco,
          que es lo mismo que decía el tinte de antes. */}
      <div
        className={cn(
          "relative overflow-hidden rounded-[26px] border p-gap-md sm:p-gap-lg",
          dePago
            ? "border-verde-200/60 bg-[linear-gradient(120deg,#edf7ef,#f7fbf7)]"
            : "border-ink/5 bg-white",
        )}
      >
        {dePago && (
          <span
            aria-hidden
            className="pointer-events-none absolute -right-[110px] -top-[160px] size-[250px] rounded-full bg-verde-400/10"
          />
        )}

        <div className="relative flex flex-wrap items-center justify-between gap-gap-sm">
          <h3 className="font-lv-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
            Tu plan actual
          </h3>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-[11px] py-[6px] font-lv-display text-[10px] font-extrabold uppercase tracking-[0.09em]",
              dePago
                ? "border border-verde-300/70 bg-white/80 text-verde-700"
                : "border border-ink/10 bg-sand text-ink-soft/75",
            )}
          >
            {nombreDe(plan, cat)}
            {dePago ? " · Activo" : ""}
          </span>
        </div>

        <div className="relative mt-gap-md grid gap-gap-md sm:grid-cols-[.8fr_1.2fr] sm:items-center">
          <div>
            <p className="font-lv-display text-[28px] font-bold leading-none tracking-[-0.03em] text-ink">
              {nombreDe(plan, cat)}
            </p>
            <p className="mt-gap-2xs text-small text-ink-soft/70">
              {lemaDe(plan, cat)}
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-gap-xs sm:grid-cols-2 sm:gap-x-gap-sm">
            {visibles.map((punto, i) => (
              <li
                key={`${i}-${punto}`}
                className="flex items-start gap-gap-xs text-small text-ink"
              >
                <span className="mt-[1px] grid size-[19px] shrink-0 place-items-center rounded-full bg-verde-100 text-verde-700">
                  <Check size={12} strokeWidth={2.6} />
                </span>
                <span className="text-pretty">{punto}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-gap-md flex flex-wrap items-center gap-gap-sm">
          <button
            type="button"
            onClick={onVerPlanes}
            className="inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
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
      </div>
    </section>
  );
}
