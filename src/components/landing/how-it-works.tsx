"use client";

import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Escribe lo que quieres",
    description:
      "No necesitas elegir categorias ni llenar filtros. Simplemente describe lo que buscas como lo harías con un amigo: \"un cafe tranquilo cerca de mi que acepte MLC\".",
  },
  {
    title: "La Verde interpreta",
    description:
      "La app entiende el contexto cubano: monedas, barrios, horarios y costumbres. No es un buscador generico, entiende lo que necesitas.",
  },
  {
    title: "Encuentra tu lugar",
    description:
      "RESULTADOS en el mapa con direccion exacta, recomendaciones personalizadas y toda la info que necesitas para llegar.",
  },
];

function StepCard({
  index,
  title,
  description,
}: {
  index: number;
  title: string;
  description: string;
}) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-[600ms] ease-out",
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-6 opacity-0",
      )}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="grid grid-cols-1 items-start gap-gap-md md:block">
        <div className="relative mb-gap-md font-display text-[clamp(48px,6vw,72px)] font-bold leading-none tracking-[-0.04em] md:mb-gap-md">
          <span className="text-accent/10" aria-hidden>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span
            className="absolute inset-0 text-accent/18"
            aria-hidden
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <div>
          <h3 className="mb-2 text-[20px] font-display font-semibold text-foreground">
            {title}
          </h3>
          <p className="text-[15px] leading-[1.6] text-muted-foreground text-pretty">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function HowItWorks() {
  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();

  return (
    <section
      id="como-funciona"
      className="border-t border-border bg-surface py-[clamp(48px,8vw,96px)]"
    >
      <div className="mx-auto max-w-container px-gutter md:px-gutter-lg">
        <div
          ref={headerRef}
          className={cn(
            "mx-auto mb-gap-3xl max-w-[48ch] text-center transition-all duration-[600ms] ease-out",
            headerVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-6 opacity-0",
          )}
        >
          <p className="font-mono text-xs font-medium uppercase tracking-[0.1em] text-accent">
            Como funciona
          </p>
          <h2 className="mt-gap-xs text-h2 font-display font-semibold text-foreground text-balance">
            Tres pasos. Sin registros complicados.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-gap-xl md:grid-cols-3">
          {STEPS.map((step, i) => (
            <StepCard
              key={step.title}
              index={i}
              title={step.title}
              description={step.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
