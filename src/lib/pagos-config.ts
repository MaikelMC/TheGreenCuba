import type { FacturaMetodoPago } from "@/lib/db/schema/facturas";

/**
 * Los datos con los que se paga una propuesta.
 *
 * Viven en variables de entorno, no en la página: el usuario de QvaPay, la
 * tarjeta y el titular cambian sin desplegar código, y ningún dato de cobro
 * viaja escrito en el repositorio. Si un dato falta, el método no se ofrece;
 * es mejor no enseñar una opción que no se puede completar.
 */
export interface DatosPago {
  qvapay: { usuario: string } | null;
  transferencia: { tarjeta: string; titular: string } | null;
  /** Solo se enseña a los negocios de Santiago de Cuba. */
  efectivo: boolean;
}

function limpio(valor: string | undefined): string | null {
  const texto = valor?.trim();
  return texto ? texto : null;
}

export function datosPago(
  env: NodeJS.ProcessEnv = process.env,
): DatosPago {
  const usuario = limpio(env.PAGOS_QVAPAY_USUARIO);
  const tarjeta = limpio(env.PAGOS_CUP_TARJETA);
  const titular = limpio(env.PAGOS_CUP_TITULAR);

  return {
    qvapay: usuario ? { usuario } : null,
    transferencia:
      tarjeta && titular ? { tarjeta, titular } : null,
    efectivo: env.PAGOS_EFECTIVO?.trim().toLowerCase() === "true",
  };
}

/**
 * El efectivo solo existe en Santiago de Cuba. Se compara sin tildes ni
 * mayúsculas porque el dato viene de la ficha y no de una lista cerrada.
 */
export function esSantiago(provincia: string | null | undefined): boolean {
  const normalizada = (provincia ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return normalizada === "santiago de cuba" || normalizada === "santiago";
}

/** Los métodos que se pueden ofrecer a un negocio concreto. */
export function metodosDisponibles(
  provincia: string | null | undefined,
  datos: DatosPago = datosPago(),
): FacturaMetodoPago[] {
  const metodos: FacturaMetodoPago[] = [];
  if (datos.qvapay) metodos.push("qvapay");
  if (datos.transferencia) metodos.push("transferencia");
  if (datos.efectivo && esSantiago(provincia)) metodos.push("efectivo");
  return metodos;
}

/** ¿El negocio puede elegir este método? */
export function metodoDisponible(
  metodo: FacturaMetodoPago,
  provincia: string | null | undefined,
  datos: DatosPago = datosPago(),
): boolean {
  return metodosDisponibles(provincia, datos).includes(metodo);
}
