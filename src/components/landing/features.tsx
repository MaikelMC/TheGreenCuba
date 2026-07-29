"use client";

import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    title: "IA que entiende Cuba",
    description:
      "No es un chatbot generico. La Verde conoce barrios, monedas, horarios y costumbres cubanas para darte resultados reales.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3c-4.97 0-9 3.58-9 8s4.03 8 9 8c.71 0 1.4-.08 2.06-.22L19 21l-.78-3.46C20.04 16.21 21 14.21 21 12c0-4.42-4.03-8-9-8z" />
        <path d="M10 9.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5.67-1.5 1.5" />
      </svg>
    ),
  },
  {
    title: "Recomendaciones contextualizadas",
    description:
      "La Verde te recomienda segun tu ubicacion, la hora, el momento y lo que buscas. Como un amigo que conoce bien la ciudad.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m0-10.14l2.83 2.83m4.48 4.48l2.83 2.83" />
      </svg>
    ),
  },
  {
    title: "Rapido incluso sin datos",
    description:
      "Funciona con conexion lenta. Tiles ligeros, cache inteligente y skeleton states para que nunca veas una pantalla en blanco.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
];

const STATS = [
  {
    value: "3",
    label: "Tipos de moneda reconocidos: CUP, MLC y USD.",
  },
  {
    value: "15+",
    label: "Categorias de lugares cubanos, de cafeteria a bodega.",
  },
  {
    value: "~2s",
    label: "Tiempo promedio de busqueda a resultado en conexion 3G.",
  },
];

export function Features() {
  const { ref: featuresHeaderRef, isVisible: featuresHeaderVisible } =
    useScrollReveal();
  const { ref: statsRef, isVisible: statsVisible } = useScrollReveal();

  return (
    <>
      <section className="border-t border-border bg-surface py-[clamp(48px,8vw,96px)]">
        <div className="mx-auto max-w-container px-gutter md:px-gutter-lg">
          <div
            ref={featuresHeaderRef}
            className={cn(
              "mx-auto mb-gap-3xl max-w-[42ch] text-center transition-all duration-[600ms] ease-out",
              featuresHeaderVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-6 opacity-0",
            )}
          >
            <p className="font-mono text-xs font-medium uppercase tracking-[0.1em] text-accent">
              Por que La Verde
            </p>
            <h2 className="mt-gap-xs text-h2 font-display font-semibold text-foreground text-balance">
              No es otro buscador de Google.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-gap-lg md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <FeatureCard
                key={f.title}
                index={i}
                icon={f.icon}
                title={f.title}
                description={f.description}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="py-[clamp(48px,8vw,96px)]">
        <div className="mx-auto max-w-container px-gutter md:px-gutter-lg">
          <div
            ref={statsRef}
            className={cn(
              "grid grid-cols-1 gap-gap-lg transition-all duration-[600ms] ease-out md:grid-cols-3",
              statsVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-6 opacity-0",
            )}
          >
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="transition-all duration-[600ms] ease-out"
                style={{
                  transitionDelay: `${i * 100}ms`,
                  transform: statsVisible
                    ? "translateY(0)"
                    : "translateY(24px)",
                  opacity: statsVisible ? 1 : 0,
                }}
              >
                <div className="font-display text-[clamp(48px,7vw,80px)] font-bold leading-[0.95] tracking-[-0.04em] text-accent">
                  <span className="font-mono font-variant-numeric-tabular">
                    {stat.value.includes("+") || stat.value.includes("s")
                      ? stat.value
                      : stat.value}
                  </span>
                </div>
                <p className="mt-2.5 max-w-[28ch] text-[15px] leading-[1.5] text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function FeatureCard({
  index,
  icon,
  title,
  description,
}: {
  index: number;
  icon: React.ReactNode;
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
      <div className="mb-gap-lg flex size-11 items-center justify-center rounded-lv bg-accent/12">
        <div className="size-[22px] text-accent">{icon}</div>
      </div>
      <h3 className="mb-2 font-display text-[20px] font-semibold text-foreground">
        {title}
      </h3>
      <p className="text-[15px] leading-[1.6] text-muted-foreground text-pretty">
        {description}
      </p>
    </div>
  );
}
