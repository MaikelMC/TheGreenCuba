import type { Metadata } from "next";
import { getAppUser } from "@/lib/auth/user";
import { cargarCatalogo } from "@/lib/catalogo-server";
import { ownerPlaces } from "@/lib/db/queries";
import { CATEGORIAS } from "@/content/servicios-categorias";
import { CatalogoServicios } from "@/components/servicios/catalogo-servicios";
import { TasaCambioNota } from "@/components/pricing/tasa-cambio-nota";

/**
 * El catálogo de todo lo que vende La Verde, por categoría de negocio.
 *
 * Los packs sugeridos y los estándar acaban en la sección de planes, que es
 * donde está el botón de QvaPay. Si el visitante no tiene sesión o no tiene
 * negocio, el CTA pasa antes por el alta: una factura de QvaPay necesita un
 * negocio, y el pack elegido viaja en la URL hasta esa sección.
 */

const SERVICIOS_TOTALES = CATEGORIAS.reduce(
  (suma, categoria) => suma + categoria.servicios.length,
  0,
);

/** Los precios en CUP cambian con la tasa: misma cadencia que CambioCUP. */
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Servicios para negocios · La Verde",
  description: `Catálogo completo de La Verde: ${SERVICIOS_TOTALES} servicios para negocios, agrupados por categoría, con packs armados para cada una.`,
  alternates: { canonical: "/servicios" },
  openGraph: {
    title: "Servicios para negocios · La Verde",
    description:
      "Catálogo completo por categoría, con packs ya armados para completar tu negocio.",
    images: ["/api/og"],
  },
};

export default async function ServiciosPage() {
  const [catalogo, usuario] = await Promise.all([
    cargarCatalogo(),
    getAppUser().catch(() => null),
  ]);

  let tieneNegocio = false;
  if (usuario) {
    const lugares = await ownerPlaces(usuario.id).catch(() => []);
    tieneNegocio = lugares.length > 0;
  }

  return (
    <div className="mx-auto w-full max-w-container px-gutter py-10 md:px-gutter-lg md:py-16">
      <header className="max-w-3xl lv-view-in">
        <p className="lv-mono text-[11px] uppercase tracking-[0.2em] text-verde-700">
          Servicios
        </p>
        <h1 className="mt-4 font-lv-display text-h1 font-bold tracking-[-0.04em] text-ink text-balance">
          Todo lo que tu negocio puede tener en La Verde
        </h1>
        <p className="mt-4 text-lead text-ink-soft/75">
          El catálogo completo, agrupado por tipo de negocio. Cada categoría
          trae lo que ya existe, lo que está por llegar y un pack armado con los
          servicios que la completan. Elige uno suelto o un pack: se paga al mes
          y se cambia cuando quieras.
        </p>
        <p className="mt-3 text-small text-ink-soft/60">
          Lo marcado como <span className="font-semibold text-ink-soft/80">Próximamente</span>{" "}
          todavía no está en La Verde. Puedes pedir que te avisemos por WhatsApp
          el día que salga.
        </p>

        <div className="mt-5">
          <TasaCambioNota catalogo={catalogo} />
        </div>

        <ol className="mt-6 grid grid-cols-1 gap-2 text-small text-ink-soft/75 sm:grid-cols-3">
          <li className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
            <span className="font-semibold text-ink">1. Elige</span> el servicio
            o el pack de tu categoría.
          </li>
          <li className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
            <span className="font-semibold text-ink">2. Crea tu negocio</span> si
            todavía no lo tienes; la elección se queda marcada.
          </li>
          <li className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
            <span className="font-semibold text-ink">3. Paga el mes</span> con
            QvaPay; la suscripción se activa al confirmarse.
          </li>
        </ol>
      </header>

      <CatalogoServicios
        catalogo={catalogo}
        autenticado={Boolean(usuario)}
        tieneNegocio={tieneNegocio}
      />
    </div>
  );
}
