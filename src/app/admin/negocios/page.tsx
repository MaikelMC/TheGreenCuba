import { BusinessList } from "@/components/admin/business-list";
import { cargarNegociosAdmin } from "@/lib/admin-negocios";

export const metadata = { title: "Negocios" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Negocios se lee en el servidor: filtros, contadores, orden y página viven en
 * la URL y la consulta solo trae las 20 filas que se ven. La tabla cliente se
 * encarga de la selección y de refrescar después de cada cambio.
 */
export default async function NegociosPage({ searchParams }: Props) {
  const params = await searchParams;
  const datos = await cargarNegociosAdmin(params);
  return <BusinessList datos={datos} />;
}
