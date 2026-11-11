import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-10">
      {/* Encabezado */}
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary uppercase tracking-wide">
          {servicio.nombre}
        </p>
        <h1 className="text-3xl font-bold leading-tight">{servicio.titulo}</h1>
        <p className="text-muted-foreground text-lg">{servicio.descripcionCorta}</p>
      </header>

      {/* Precio */}
      <section className="rounded-xl border bg-card p-5 space-y-3">
        <PrecioServicio precio={servicio.precio} catalogo={catalogo} />
        <TasaCambioNota catalogo={catalogo} />
        <CtaServicio
          servicio={{ nombre: servicio.nombre, anclaPanel: servicio.anclaPanel }}
          tieneServicio={tieneServicio}
          tieneNegocio={tieneNegocio}
          esAutenticado={!!usuario}
        />
      </section>

      {/* Te pasa esto */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">¿Te pasa esto?</h2>
        <ul className="space-y-2">
          {servicio.tePasaEsto.map((item, i) => (
            <li key={i} className="flex gap-3 text-muted-foreground">
              <span className="mt-0.5 shrink-0 text-primary">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Así funciona */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Así funciona</h2>
        <ol className="space-y-3">
          {servicio.asFunciona.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Lo que incluye / Lo que no hace */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Lo que incluye
          </h2>
          <ul className="space-y-2">
            {servicio.loQueIncluye.map((item, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <XCircle className="h-5 w-5 text-muted-foreground" />
            Lo que no hace
          </h2>
          <ul className="space-y-2">
            {servicio.loQueNoHace.map((item, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Qué necesitas */}
      <section className="rounded-xl border bg-muted/50 p-5 space-y-2">
        <h2 className="font-semibold">Qué necesitas para usarlo</h2>
        <ul className="space-y-1">
          {servicio.queNecesitas.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground">
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Preguntas frecuentes */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Preguntas frecuentes</h2>
        <div className="space-y-4">
          {servicio.preguntas.map((p, i) => (
            <div key={i} className="rounded-xl border p-5 space-y-2">
              <p className="font-medium">{p.pregunta}</p>
              <p className="text-sm text-muted-foreground">{p.respuesta}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="font-semibold">¿Lo quieres para tu negocio?</h2>
        <CtaServicio
          servicio={{ nombre: servicio.nombre, anclaPanel: servicio.anclaPanel }}
          tieneServicio={tieneServicio}
          tieneNegocio={tieneNegocio}
          esAutenticado={!!usuario}
        />
      </section>
    </div>
  );
}
