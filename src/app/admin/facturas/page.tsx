import { siteConfig } from "@/config/site";
import { listarFacturas } from "@/lib/facturas-server";
import { FacturasPanel } from "@/components/admin/facturas-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Facturas · Administración",
  robots: { index: false, follow: false },
};

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const busqueda = typeof q === "string" ? q : "";
  const facturas = await listarFacturas(busqueda);
  return (
    <FacturasPanel
      facturas={facturas}
      q={busqueda}
      baseUrl={siteConfig.url.replace(/\/+$/, "")}
    />
  );
}
