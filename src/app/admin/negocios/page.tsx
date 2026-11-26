import Link from "next/link";
import { ShieldQuestion } from "lucide-react";
import { BusinessList } from "@/components/admin/business-list";
import { TiposSospechososPanel } from "@/components/admin/tipos-sospechosos-panel";
import { cargarNegociosAdmin } from "@/lib/admin-negocios";
import { listarTiposSospechosos } from "@/lib/admin-tipos-sospechosos-server";

export const metadata = { title: "Negocios" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Negocios se lee en el servidor: filtros, contadores, orden y página viven en
 * la URL y la consulta solo trae las 20 filas que se ven. La tabla cliente se
 * encarga de la selección y de refrescar después de cada cambio.
 *
 * `?tipos=1` abre la revisión de tipos sospechosos en el mismo sitio, sin una
 * sección nueva en la navegación ni otra pantalla que mantener.
 */
export default async function NegociosPage({ searchParams }: Props) {
  const params = await searchParams;

  if (params.tipos === "1") {
    try {
      const sospechosos = await listarTiposSospechosos();
      return <TiposSospechososPanel sospechosos={sospechosos} />;
    } catch {
      return (
        <p role="alert" className="text-small text-destructive">
          No se pudieron cargar los tipos sospechosos. Intenta de nuevo.
        </p>
      );
    }
  }

  const datos = await cargarNegociosAdmin(params);
  return (
    <>
      <div className="mb-gap-sm flex justify-end">
        <Link
          href="/admin/negocios?tipos=1"
          className="inline-flex min-h-11 items-center gap-[6px] rounded-full border border-ink/10 bg-white px-4 font-lv-display text-small font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50"
        >
          <ShieldQuestion size={15} strokeWidth={1.8} aria-hidden />
          Revisar tipos sospechosos
        </Link>
      </div>
      <BusinessList datos={datos} />
    </>
  );
}
