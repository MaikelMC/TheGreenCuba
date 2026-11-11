import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SERVICIOS } from "@/content/servicios";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { PrecioServicio } from "@/components/servicios/precio-servicio";
import { TasaCambioNota } from "@/components/pricing/tasa-cambio-nota";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Servicios para negocios de comida a domicilio · La Verde",
  description:
    "Todo lo que necesitas para recibir pedidos por WhatsApp, gestionar tu carta y fidelizar clientes. Elige solo lo que uses.",
  openGraph: {
    title: "Servicios para comida a domicilio · La Verde",
    description:
      "Todo lo que necesitas para recibir pedidos por WhatsApp, gestionar tu carta y fidelizar clientes.",
    images: ["/api/og"],
  },
};

const SERVICIOS_CATEGORIA = SERVICIOS.filter(
  (s) => s.categoria === "comida-a-domicilio",
);

/**
 * La landing de la categoría «comida a domicilio».
 *
 * Misma gramática visual que el catálogo: tarjetas `bg-white` con borde `ink`
 * (las dos se oscurecen con `data-theme="dark"`), pastillas de 48 px y la
 * curva `ease-outquint` en cada interacción.
 */
export default async function ComidaADomicilioPage() {
  const catalogo = await cargarCatalogo();

  return (
    <div className="mx-auto w-full max-w-4xl px-gutter py-10 md:px-gutter-lg md:py-16 lv-view-in">
      <Link
        href="/servicios"
        className="inline-flex items-center gap-1.5 text-meta font-semibold text-ink-soft/70 transition-colors duration-300 hover:text-verde-700"
      >
        <ArrowLeft size={13} aria-hidden />
        Todos los servicios
      </Link>

      <header className="mt-6">
        <p className="lv-mono text-[11px] uppercase tracking-[0.2em] text-verde-700">
          Comida a domicilio
        </p>
        <h1 className="mt-3 font-lv-display text-h1 font-bold tracking-[-0.04em] text-ink text-balance">
          Herramientas para negocios de comida
        </h1>
        <p className="mt-4 max-w-2xl text-lead text-ink-soft/75 text-pretty">
          Carta en línea, pedidos por WhatsApp, horarios de cocina y tarjeta de
          cliente frecuente. Contrata solo lo que necesitas, uno a uno o
          combinado.
        </p>
        <div className="mt-5">
          <TasaCambioNota catalogo={catalogo} />
        </div>
      </header>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {SERVICIOS_CATEGORIA.map((servicio) => (
          <Link
            key={servicio.slug}
            href={`/servicios/${servicio.slug}`}
            className="group flex h-full flex-col gap-3 rounded-3xl border border-ink/10 bg-white p-5 shadow-soft transition duration-300 ease-outquint hover:-translate-y-[2px] hover:border-verde-300 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="lv-mono text-[10px] uppercase tracking-[0.18em] text-verde-700">
                  {servicio.nombre}
                </p>
                <h2 className="mt-2 font-lv-display text-lg font-bold leading-snug tracking-[-0.02em] text-ink">
                  {servicio.titulo}
                </h2>
              </div>
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-ink/10 text-ink-soft/70 transition-colors duration-300 group-hover:border-verde-300 group-hover:bg-verde-50 group-hover:text-verde-600">
                <ArrowRight size={14} aria-hidden />
              </span>
            </div>

            <p className="text-small leading-relaxed text-ink-soft/75">
              {servicio.descripcionCorta}
            </p>

            <div className="mt-auto border-t border-ink/10 pt-3">
              <PrecioServicio precio={servicio.precio} catalogo={catalogo} />
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-6 rounded-3xl border border-dashed border-ink/15 bg-sand/40 p-6">
        <h2 className="font-lv-display text-body font-bold tracking-[-0.01em] text-ink">
          ¿No sabes por cuál empezar?
        </h2>
        <p className="mt-2 max-w-2xl text-small leading-relaxed text-ink-soft/75">
          La mayoría empieza por la{" "}
          <Link
            href="/servicios/carta-y-qr"
            className="font-semibold text-verde-700 underline decoration-verde-300 underline-offset-2 transition-colors hover:text-verde-800"
          >
            carta en línea con QR
          </Link>
          . Con ella ya tienes los productos con foto y el QR para imprimir. Los
          pedidos y la fidelización se pueden añadir después, cuando los
          necesites.
        </p>
      </section>
    </div>
  );
}
