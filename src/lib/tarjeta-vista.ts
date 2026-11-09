/**
 * La tarjeta del cliente tal como viaja al móvil.
 *
 * La página y `/api/tarjeta/[token]` devuelven lo mismo, para que la isla de la
 * tarjeta pueda refrescar los datos sin recargar. Se construye en el servidor:
 * el teléfono sale ya enmascarado y no se manda nada que no se vea en pantalla
 * —ni el id del cliente, ni el historial completo, ni quién hizo cada ajuste—.
 */

import type { EstadoTarjeta } from "./fidelidad";
import type { TarjetaPublica } from "./fidelidad-server";
import { enmascararTelefono } from "./telefono";

export interface MovimientoVistaDTO {
  id: string;
  tipo: "sello" | "ajuste" | "canje" | "reversion";
  cantidad: number;
  nota: string | null;
  metaIndice: number | null;
  ciclo: number;
  /** ISO. El cliente lo formatea en America/Havana. */
  creadoEn: string;
  pedidoCodigo: string | null;
  anulado: boolean;
}

export interface TarjetaVistaDTO {
  negocio: { id: string; nombre: string; slug: string; logoUrl: string | null };
  cliente: { nombre: string | null; telefono: string };
  tarjeta: EstadoTarjeta;
  movimientos: MovimientoVistaDTO[];
  /** ISO del momento en que se generó esta vista. */
  generadoEn: string;
}

/**
 * Convierte lo que lee la base en lo que se pinta.
 *
 * `movimientos` ya viene recortado a los últimos por `tarjetaPublica()`.
 */
export function aTarjetaVista(
  data: TarjetaPublica,
  generadoEn: Date = new Date(),
): TarjetaVistaDTO {
  return {
    negocio: data.negocio,
    cliente: {
      nombre: data.cliente.nombre,
      telefono: enmascararTelefono(data.cliente.telefono) ?? "",
    },
    tarjeta: data.tarjeta,
    movimientos: data.movimientos.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      cantidad: m.cantidad,
      nota: m.nota,
      metaIndice: m.metaIndice,
      ciclo: m.ciclo,
      creadoEn: m.creadoEn.toISOString(),
      pedidoCodigo: m.pedidoCodigo,
      anulado: m.anulado,
    })),
    generadoEn: generadoEn.toISOString(),
  };
}
