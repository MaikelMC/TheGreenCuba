/**
 * Los avisos, del lado del navegador.
 *
 * La campana del home y la pantalla completa pintan la misma lista. Las dos
 * decidían a dónde llevar y qué icono poner mirando el título —`includes(
 * "rechazada")`, `includes("aprobada")`—, así que un aviso masivo titulado
 * «Oferta aprobada» acababa mandando al perfil y con el icono equivocado. La
 * columna `type` es la que sabe qué es el aviso: es la que se escribe en el
 * servidor y no cambia con la redacción.
 */

export interface UserNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  placeId: string | null;
  /** Remitente visible de los avisos de administración. */
  senderName?: string | null;
}

/**
 * A dónde lleva abrir el aviso.
 *
 * - Un rechazo de negocio se corrige en el perfil, que es donde vive el
 *   formulario.
 * - Un alta enviada también: la ficha todavía no está publicada, así que no hay
 *   página pública que enseñar.
 * - Los proyectos tienen su propia pantalla.
 * - El resto con ficha lleva a la ficha (aprobación, prueba por terminar).
 * - Lo que no tiene destino propio —bienvenida, rol, contraseña, campañas—
 *   vuelve al perfil.
 */
export function destinoAviso(item: UserNotification): string {
  if (
    item.type === "business_rejected" ||
    item.type === "business_submitted"
  ) {
    return "/profile?seccion=negocio";
  }
  if (item.type.startsWith("project_")) return "/projects";
  if (item.placeId) return `/place/${item.placeId}`;
  return "/profile";
}

/** Los avisos que piden corregir algo. */
export function esAvisoRechazado(item: UserNotification): boolean {
  return item.type === "business_rejected" || item.type === "project_rejected";
}

/** Los avisos que confirman una publicación. */
export function esAvisoAprobado(item: UserNotification): boolean {
  return item.type === "business_approved" || item.type === "project_approved";
}
