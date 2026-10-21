import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FUNCIONES,
  GRATIS,
  PACKS,
  PACKS_ORDER,
  TRIAL_DIAS,
  type Pack,
} from "@/lib/plans";
import { Reveal } from "./reveal";
import { ServicesPicker } from "./services-picker";

interface Plan {
  key: "gratis" | Pack;
  nombre: string;
  lema: string;
  usd: number;
  items: readonly string[];
  destacado: boolean;
}

const PLANES: Plan[] = [
  {
    key: "gratis",
    nombre: "Gratis",
    lema: "Para que te encuentren.",
    usd: 0,
    items: GRATIS.map((funcion) => FUNCIONES[funcion].texto),
    destacado: false,
  },
  ...PACKS_ORDER.map((key) => ({
    key,
    nombre: PACKS[key].nombre,
    lema: PACKS[key].lema,
    usd: PACKS[key].usd,
    items: PACKS[key].texto.split("\n"),
    destacado: key === "pro",
  })),
];

/** «3,5» en vez de «3.5»: el catálogo manda precios en dólares con coma. */
function precio(usd: number) {
  return usd % 1 === 0 ? String(usd) : usd.toFixed(1).replace(".", ",");
}

export function Pricing() {
  return (
    <section id="planes" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-container px-gutter md:px-gutter-lg">
        <div className="mx-auto max-w-2xl text-center">
          <p className="lv-mono text-[11px] uppercase tracking-[0.2em] text-verde-700">
            03 / 04 · Planes
          </p>
          <Reveal
            as="h2"
            text="Precios claros, sin sorpresas."
            accent="sorpresas"
            className="mt-4 font-lv-display text-[clamp(32px,5vw,52px)] font-bold leading-[1.02] tracking-[-0.04em] text-ink text-balance"
          />
          <Reveal
            as="p"
            text={`${TRIAL_DIAS} días de prueba de todos los servicios.`}
            delay={120}
            className="mt-4 text-base leading-relaxed text-ink-soft/75"
          />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANES.map((plan) => (
            <article
              key={plan.key}
              className={cn(
                "relative flex flex-col rounded-3xl border p-6 shadow-soft sm:p-7",
                plan.destacado
                  ? "border-ink bg-ink text-white shadow-card"
                  : "border-ink/10 bg-white",
              )}
            >
              {plan.destacado ? (
                <span className="absolute right-5 top-5 rounded-full bg-verde-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-verde-950">
                  Más completo
                </span>
              ) : null}

              <h3
                className={cn(
                  "font-lv-display text-lg font-bold tracking-[-0.02em]",
                  plan.destacado ? "text-white" : "text-ink",
                )}
              >
                {plan.nombre}
              </h3>
              <p
                className={cn(
                  "mt-1 text-sm",
                  plan.destacado ? "text-white/65" : "text-ink-soft/70",
                )}
              >
                {plan.lema}
              </p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span
                  className={cn(
                    "font-lv-display text-4xl font-bold tracking-[-0.04em]",
                    plan.destacado ? "text-white" : "text-ink",
                  )}
                >
                  {precio(plan.usd)}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    plan.destacado ? "text-white/60" : "text-ink-soft/65",
                  )}
                >
                  USD / mes
                </span>
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.items.map((item) => (
                  <li
                    key={item}
                    className={cn(
                      "flex gap-2 text-[13px] leading-snug",
                      plan.destacado ? "text-white/75" : "text-ink-soft/75",
                    )}
                  >
                    <Check
                      size={14}
                      strokeWidth={2.4}
                      className={cn(
                        "mt-0.5 shrink-0",
                        plan.destacado ? "text-verde-300" : "text-verde-600",
                      )}
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href={`/register?next=${encodeURIComponent(`/onboarding?plan=${plan.key}`)}`}
                className={cn(
                  "mt-7 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition duration-300 ease-outquint active:scale-[0.98]",
                  plan.destacado
                    ? "bg-verde-400 text-verde-950 hover:bg-verde-300"
                    : "border border-ink/15 text-ink hover:border-ink/30 hover:bg-sand",
                )}
              >
                {plan.key === "gratis" ? "Empezar gratis" : `Elegir ${plan.nombre}`}
              </Link>
            </article>
          ))}
        </div>

        <ServicesPicker />
      </div>
    </section>
  );
}
