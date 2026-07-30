"use client";

import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  {
    query: "Quiero un cafe tranquilo cerca de mi que acepte MLC",
    pill: "cafeteria",
    tags: ["MLC", "tranquilo"],
  },
  {
    query:
      "Restaurante con vista al mar para una cena romantica este viernes",
    pill: "restaurante",
    tags: ["vista al mar", "romantico"],
  },
  {
    query:
      "Discoteca que toque reggaeton cubano y este abierta despues de la 1am",
    pill: "vida nocturna",
    tags: ["reggaeton", "tarde"],
  },
  {
    query:
      "Mercado donde vendan frutas frescas baratas cerca del Vedado",
    pill: "mercado",
    tags: ["frutas", "barato"],
  },
  {
    query:
      "Lugar para trabajar con wifi estable y cafe bueno en La Habana",
    pill: "coworking",
    tags: ["wifi", "productivo"],
  },
  {
    query:
      "Bar de tequila con musica en vivo que no sea carisimo",
    pill: "bar",
    tags: ["tequila", "musica en vivo"],
  },
];

function ExampleCard({
  index,
  query,
  pill,
  tags,
}: {
  index: number;
  query: string;
  pill: string;
  tags: string[];
}) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-3.5 rounded-lv-lg border border-border bg-surface p-6 transition-all duration-[600ms] ease-out hover:border-[oklch(62%_0.16_145/0.3)] hover:shadow-lv-sm",
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-6 opacity-0",
      )}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <p className="text-[17px] font-medium leading-[1.5] text-foreground text-pretty">
        <span
          className="font-display text-[24px] text-accent/60"
          aria-hidden
        >
          &ldquo;
        </span>
        {query}
        <span
          className="font-display text-[24px] text-accent/60"
          aria-hidden
        >
          &rdquo;
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/12 px-3 py-1 font-mono text-xs font-medium uppercase tracking-[0.05em] text-accent">
          {pill}
        </span>
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-full border border-border px-3 py-1 text-[13px] font-medium text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SearchExamples() {
  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();

  return (
    <section
      id="ejemplos"
      className="border-t border-border py-[clamp(48px,8vw,120px)]"
    >
      <div className="mx-auto max-w-container px-gutter md:px-gutter-lg">
        <div
          ref={headerRef}
          className={cn(
            "mb-gap-2xl max-w-[48ch] transition-all duration-[600ms] ease-out",
            headerVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-6 opacity-0",
          )}
        >
          <p className="font-mono text-xs font-medium uppercase tracking-[0.1em] text-accent">
            Busquedas reales
          </p>
          <h2 className="mt-gap-xs text-h2 font-display font-semibold text-foreground text-balance">
            Asi habla Cuba con La Verde
          </h2>
          <p className="mt-gap-sm text-lead text-muted-foreground text-pretty">
            Ejemplos de como los usuarios encuentran lugares con lenguaje
            natural.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-gap-lg md:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((ex, i) => (
            <ExampleCard
              key={ex.query}
              index={i}
              query={ex.query}
              pill={ex.pill}
              tags={ex.tags}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
