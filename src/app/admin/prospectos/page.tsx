import { ProspectosBoard } from "@/components/admin/prospectos-board";
import {
  listarAdminsProspecto,
  listarProspectosAdmin,
} from "@/lib/prospectos-server";

export const metadata = { title: "Prospectos" };

/**
 * El tablero comercial.
 *
 * El layout de `/admin` ya comprobó el rol; esta página solo lee. Los datos
 * llegan resueltos del servidor —responsable y negocio incluidos— para que el
 * tablero no tenga que cruzar tres listas en el navegador.
 */
export default async function ProspectosPage() {
  const [prospectos, admins] = await Promise.all([
    listarProspectosAdmin(),
    listarAdminsProspecto(),
  ]);

  return <ProspectosBoard prospectosIniciales={prospectos} admins={admins} />;
}
