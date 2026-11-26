/**
 * Qué botón principal lleva la tarjeta de un negocio.
 *
 * Módulo puro: la misma regla la usan la etiqueta y el clic, y las pruebas.
 * Primero pedir (carrito o WhatsApp), después cita, y si no hay nada de eso,
 * cómo llegar.
 */

export type AccionPrincipalNegocio = "pedir" | "pedir-cita" | "como-llegar";

export interface DatosAccionNegocio {
  pedidosHabilitado: boolean;
  domicilio: boolean;
  whatsapp: string | null;
  reservaHabilitada: boolean;
  tipoReserva: "mesa" | "apartado" | "cita" | null;
}

export function accionPrincipalNegocio(
  negocio: DatosAccionNegocio,
): AccionPrincipalNegocio {
  if (
    negocio.pedidosHabilitado ||
    (negocio.domicilio && Boolean(negocio.whatsapp))
  ) {
    return "pedir";
  }
  if (negocio.reservaHabilitada && negocio.tipoReserva === "cita") {
    return "pedir-cita";
  }
  return "como-llegar";
}

export function etiquetaAccionPrincipal(
  accion: AccionPrincipalNegocio,
): string {
  if (accion === "pedir") return "Pedir";
  if (accion === "pedir-cita") return "Pedir cita";
  return "Cómo llegar";
}
