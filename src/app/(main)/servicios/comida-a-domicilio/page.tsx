import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

export default async function ComidaADomicilioPage() {
  const catalogo = await cargarCatalogo();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-10">
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary uppercase tracking-wide">
          Comida a domicilio
        </p>
        <h1 className="text-3xl font-bold leading-tight">
          Herramientas para negocios de comida
        </h1>
        <p className="text-muted-foreground text-lg">
          Carta en línea, pedidos por WhatsApp, horarios de cocina y tarjeta de cliente frecuente. Contrata solo lo que necesitas, uno a uno o combinado.
        </p>
        <TasaCambioNota catalogo={catalogo} />
      </header>

      <div className="space-y-4">
        {SERVICIOS_CATEGORIA.map((servicio) => (
          <Link
            key={servicio.slug}
            href={`/servicios/${servicio.slug}`}
            className="block rounded-xl border bg-card p-5 hover:border-primary/40 transition-colors space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {servicio.nombre}
                </p>
                <h2 className="font-semibold text-foreground">{servicio.titulo}</h2>
                <p className="text-sm text-muted-foreground">
                  {servicio.descripcionCorta}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
            </div>
            <PrecioServicio precio={servicio.precio} catalogo={catalogo} />
          </Link>
        ))}
      </div>

      <section className="rounded-xl border bg-muted/50 p-5 space-y-2">
        <h2 className="font-semibold">¿No sabes por cuál empezar?</h2>
        <p className="text-sm text-muted-foreground">
          La mayoría empieza por la{" "}
          <Link href="/servicios/carta-y-qr" className="text-primary underline underline-offset-2">
            carta en línea con QR
          </Link>
          . Con ella ya tienes los productos con foto y el QR para imprimir. Los
          pedidos y la fidelización se pueden añadir después, cuando los necesites.
        </p>
      </section>
    </div>
  );
}
