import type { FacturaMetodoPago } from "@/lib/db/schema/facturas";

/**
 * Los datos con los que se paga una propuesta.
 *
 * QvaPay se abre con la pasarela —el cobro lo confirma su webhook— y la
 * transferencia en CUP se acuerda por WhatsApp con soporte. Ninguno de los dos
 * necesita datos escritos en el entorno: si faltara la tarjeta, el chat es
 * justamente donde se pide. El efectivo sigue siendo el único que depende de
 * configuración y de la provincia del negocio.
 */
export interface DatosPago {
  /** Usuario público de QvaPay; ya no se pinta en la factura. */
  qvapay: { usuario: string } | null;
  /** Tarjeta y titular de respaldo; se dictan en el chat si hacen falta. */
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

/**
 * Los métodos que se pueden ofrecer a un negocio concreto.
 *
 * QvaPay y transferencia en CUP van siempre: la factura es un enlace que se
 * comparte y el negocio tiene que poder pagar aunque falte un dato de cobro en
 * el entorno. El efectivo, que sí exige coordinación presencial, solo aparece
 * en Santiago y cuando está activado.
 */
export function metodosDisponibles(
  provincia: string | null | undefined,
  datos: DatosPago = datosPago(),
): FacturaMetodoPago[] {
  const metodos: FacturaMetodoPago[] = ["qvapay", "transferencia"];
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
