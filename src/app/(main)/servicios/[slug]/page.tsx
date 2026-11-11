import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Minus,
  X,
} from "lucide-react";
import { getServicio, SERVICIOS } from "@/content/servicios";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { getAppUser } from "@/lib/auth/user";
import { ownerPlaces } from "@/lib/db/queries";
import { funcionesDeNegocio } from "@/lib/plans-server";
import { PrecioServicio } from "@/components/servicios/precio-servicio";
import { CtaServicio } from "@/components/servicios/cta-servicio";
import { TasaCambioNota } from "@/components/pricing/tasa-cambio-nota";

type Props = { params: Promise<{ slug: string }> };

/** El CUP del precio se recalcula al ritmo de CambioCUP. */
export const revalidate = 600;

export async function generateStaticParams() {
  return SERVICIOS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const servicio = getServicio(slug);
  if (!servicio) return {};
  return {
    title: `${servicio.titulo} · La Verde`,
    description: servicio.descripcionCorta,
    openGraph: {
      title: servicio.titulo,
      description: servicio.descripcionCorta,
      images: [`/api/og?servicio=${slug}`],
    },
  };
}

/**
 * La ficha de un servicio.
 *
 * Todo va con las clases del sistema —`ink`, `verde-*`, `sand`, `font-lv-display`
 * y las curvas `ease-outquint`— y no con los tokens shadcn (`bg-card`,
 * `text-muted-foreground`): esos leen variables CSS que `next-themes` no
 * actualiza, así que en oscuro dejaban tarjetas blancas con texto oscuro
 * dentro de una página oscura.
 *
 * Duplicamos a propósito el botón del precio arriba y abajo: quien llega desde
 * el catálogo ya sabe lo que quiere y no tiene que recorrer la ficha entera.
 */
export default async function ServicioPage({ params }: Props) {
  const { slug } = await params;
  const servicio = getServicio(slug);
  if (!servicio) notFound();

  const [catalogo, usuario] = await Promise.all([
    cargarCatalogo(),
    getAppUser().catch(() => null),
  ]);

  let tieneServicio = false;
  let tieneNegocio = false;

  if (usuario) {
    const lugares = await ownerPlaces(usuario.id);
    const primerLugar = lugares[0];
    if (primerLugar) {
      tieneNegocio = true;
      const funciones = await funcionesDeNegocio(primerLugar.id);
      tieneServicio = funciones.has(servicio.funcion);
    }
  }

  const cta = {
    servicio: { nombre: servicio.nombre, anclaPanel: servicio.anclaPanel },
    tieneServicio,
    tieneNegocio,
    esAutenticado: !!usuario,
  } as const;

  return (
    <div className="mx-auto w-full max-w-3xl px-gutter py-10 md:py-16 lv-view-in">
      <Link
        href="/servicios"
        className="inline-flex items-center gap-1.5 text-meta font-semibold text-ink-soft/70 transition-colors duration-300 hover:text-verde-700"
      >
        <ArrowLeft size={13} aria-hidden />
        Todos los servicios
      </Link>

      {/* Encabezado */}
      <header className="relative mt-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 h-48 w-[min(100%,32rem)] -translate-x-1/2 rounded-full bg-verde-400/10 blur-3xl"
        />
        <p className="lv-mono text-[11px] uppercase tracking-[0.2em] text-verde-700">
          {servicio.nombre}
        </p>
        <h1 className="mt-3 font-lv-display text-h1 font-bold tracking-[-0.04em] text-ink text-balance">
          {servicio.titulo}
        </h1>
        <p className="mt-4 max-w-2xl text-lead text-ink-soft/75 text-pretty">
          {servicio.descripcionCorta}
        </p>
      </header>

      <div className="mt-10 space-y-12">
        {/* Precio y CTA */}
        <section className="rounded-2xl border border-ink/10 bg-white p-6 sm:p-7">
          <div>
            <PrecioServicio precio={servicio.precio} catalogo={catalogo} />
          </div>
          <div className="mt-3">
            <TasaCambioNota catalogo={catalogo} />
          </div>
          <div className="mt-5">
            <CtaServicio {...cta} />
          </div>
        </section>

        {/* Te pasa esto */}
        <section aria-labelledby="te-pasa-esto" className="space-y-4">
          <h2
            id="te-pasa-esto"
            className="font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink"
          >
            ¿Te pasa esto?
          </h2>
          <ul className="space-y-2">
            {servicio.tePasaEsto.map((item, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-2xl border border-ink/10 bg-sand/40 px-4 py-3 text-small leading-relaxed text-ink-soft/80"
              >
                <span
                  aria-hidden
                  className="mt-[7px] size-1.5 shrink-0 rounded-full bg-verde-400"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Así funciona */}
        <section aria-labelledby="asi-funciona" className="space-y-4">
          <h2
            id="asi-funciona"
            className="font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink"
          >
            Así funciona
          </h2>
          <ol className="space-y-1">
            {servicio.asFunciona.map((item, i) => (
              <li key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-verde-400 font-lv-display text-[13px] font-bold text-verde-950">
                    {i + 1}
                  </span>
                  {i < servicio.asFunciona.length - 1 && (
                    <span
                      aria-hidden
                      className="mt-1 w-px flex-1 bg-ink/10"
                    />
                  )}
                </div>
                <p className="pb-5 pt-1 text-small leading-relaxed text-ink-soft/80">
                  {item}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Lo que incluye / Lo que no hace */}
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-verde-200/60 bg-verde-50/40 p-6">
            <h2 className="flex items-center gap-2.5 font-lv-display text-body font-bold tracking-[-0.01em] text-ink">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-verde-100 text-verde-600">
                <Check size={16} strokeWidth={2.6} aria-hidden />
              </span>
              Lo que incluye
            </h2>
            <ul className="mt-4 space-y-2.5">
              {servicio.loQueIncluye.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-small leading-snug text-ink-soft/75"
                >
                  <Check
                    size={14}
                    strokeWidth={2.6}
                    className="mt-0.5 shrink-0 text-verde-600"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-ink/8 bg-ink/[0.025] p-6">
            <h2 className="flex items-center gap-2.5 font-lv-display text-body font-bold tracking-[-0.01em] text-ink">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink/8 text-ink-soft/60">
                <X size={16} strokeWidth={2.6} aria-hidden />
              </span>
              Lo que no hace
            </h2>
            <ul className="mt-4 space-y-2.5">
              {servicio.loQueNoHace.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-small leading-snug text-ink-soft/75"
                >
                  <Minus
                    size={14}
                    strokeWidth={2.6}
                    className="mt-0.5 shrink-0 text-ink-soft/40"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Qué necesitas */}
        <section className="rounded-2xl border border-dashed border-ink/15 bg-sand/40 p-6">
          <h2 className="font-lv-display text-body font-bold tracking-[-0.01em] text-ink">
            Qué necesitas para usarlo
          </h2>
          <ul className="mt-3 space-y-2">
            {servicio.queNecesitas.map((item, i) => (
              <li
                key={i}
                className="flex gap-2.5 text-small leading-relaxed text-ink-soft/75"
              >
                <span
                  aria-hidden
                  className="mt-[7px] size-1.5 shrink-0 rounded-full bg-verde-400"
                />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Preguntas frecuentes */}
        <section aria-labelledby="preguntas" className="space-y-4">
          <h2
            id="preguntas"
            className="font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink"
          >
            Preguntas frecuentes
          </h2>
          <div className="space-y-3">
            {servicio.preguntas.map((p, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-ink/10 bg-white px-5 py-4 transition-colors duration-300 open:border-verde-300/70"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-lv-display text-small font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
                  {p.pregunta}
                  <ChevronDown
                    size={16}
                    className="shrink-0 text-ink-soft/60 transition-transform duration-300 ease-outquint group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="mt-2.5 text-small leading-relaxed text-ink-soft/75 motion-safe:animate-fade-in">
                  {p.respuesta}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="relative overflow-hidden rounded-2xl border border-ink bg-ink px-6 py-9 text-white shadow-card dark:border-white/10 dark:bg-[#12241a] sm:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_10%,rgba(53,175,109,0.35),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(15,122,65,0.35),transparent_45%)]"
          />
          <div className="relative">
            <h2 className="font-lv-display text-h3 font-bold tracking-[-0.02em] text-white">
              ¿Lo quieres para tu negocio?
            </h2>
            <div className="mt-5">
              <CtaServicio {...cta} onDark />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
