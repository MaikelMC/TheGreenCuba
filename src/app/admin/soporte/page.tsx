import { SupportPanel } from "@/components/admin/support-panel";

/* La bandeja de Pendientes abre una conversación concreta con `?ticket=`, y el
   panel lee ese parámetro en el cliente. La ruta se declara dinámica para que
   ese parámetro no se resuelva en un prerender. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Soporte" };

export default function AdminSoportePage() {
  return <SupportPanel />;
}
