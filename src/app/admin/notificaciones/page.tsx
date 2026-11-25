import { BroadcastPanel } from "@/components/admin/broadcast-panel";
import { leerIdsNegocios, propietariosDeNegocios } from "@/lib/admin-negocios";

export const metadata = { title: "Notificaciones" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * El altavoz acepta `?negocios=id1,id2`: la barra de Negocios manda ahí los
 * negocios seleccionados y la página resuelve sus dueños antes de pintar el
 * formulario. El envío sigue siendo el de siempre y se confirma a mano.
 */
export default async function AdminNotificacionesPage({ searchParams }: Props) {
  const params = await searchParams;
  const ids = leerIdsNegocios(params.negocios);
  const destinatarios = await propietariosDeNegocios(ids);

  return (
    <BroadcastPanel
      destinatariosIniciales={destinatarios}
      negociosPreseleccionados={ids.length}
    />
  );
}
