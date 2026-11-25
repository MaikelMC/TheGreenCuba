import { IngresosPanel } from "@/components/admin/ingresos-panel";
import { cargarIngresosAdmin } from "@/lib/admin-ingresos";

export const dynamic = "force-dynamic";

export default async function IngresosPage() {
  const datos = await cargarIngresosAdmin();
  return <IngresosPanel datos={datos} />;
}
