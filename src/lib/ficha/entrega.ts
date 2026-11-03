/**
 * La tarjeta de domicilio: cuánto cuesta llevar el pedido, cuánto tarda y
 * cuánto hay que gastar como mínimo.
 *
 * Módulo puro: lo lee la ficha para pintar la tarjeta, el carrito para sumar el
 * envío y el panel para editarlo. El costo es una unión y no un número porque
 * «gratis», «a consultar» y «gratis a partir de 20 USD» no son cifras: son
 * frases distintas, y meterlas todas en `0` haría que la ficha enseñara «0» en
 * un negocio que cobra según la zona.
 */

import type { Horario } from "./horario";

/** Una cifra con su moneda. */
export interface Monto {
  monto: number;
  moneda: string;
}

/** Cómo se cobra (o no) el envío. */
export type CostoEntrega =
  | { modo: "gratis" }
  | { modo: "consultar" }
  | ({ modo: "fijo" } & Monto)
  | ({ modo: "gratis_desde"; desde: number } & Monto)
  | { modo: "zonas"; zonas: { nombre: string; monto: number }[]; moneda: string };

/** Lo que configura el negocio para el reparto. */
export interface EntregaConfig {
  costo: CostoEntrega;
  /** Rango de tiempo estimado, en minutos. `min <= max`. */
  tiempo: { min: number; max: number };
  /** Pedido mínimo para repartir. Ausente = sin mínimo. */
  pedidoMinimo?: Monto;
  /** Horario propio del reparto. Ausente = el del local. */
  horario?: Horario;
}

function esMonto(value: unknown): value is Monto {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<Monto>;
  return (
    typeof m.monto === "number" &&
    Number.isFinite(m.monto) &&
    m.monto >= 0 &&
    typeof m.moneda === "string" &&
    m.moneda.trim().length > 0
  );
}

/**
 * Valida lo que llega por HTTP antes de guardarlo.
 *
 * Rechaza en vez de corregir: un envío negativo o un rango con `min > max` es
 * un error del formulario, y arreglarlo en silencio dejaría una tarjeta que
 * dice algo que el dueño no configuró.
 */
export function esEntregaConfig(value: unknown): value is EntregaConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const e = value as Partial<EntregaConfig>;

  const costo = e.costo;
  if (!costo || typeof costo !== "object") return false;
  switch (costo.modo) {
    case "gratis":
    case "consultar":
      break;
    case "fijo":
      if (!esMonto(costo)) return false;
      break;
    case "gratis_desde":
      if (!esMonto(costo)) return false;
      if (typeof costo.desde !== "number" || !Number.isFinite(costo.desde) || costo.desde < 0) {
        return false;
      }
      break;
    case "zonas":
      if (typeof costo.moneda !== "string" || !costo.moneda.trim()) return false;
      if (!Array.isArray(costo.zonas)) return false;
      if (
        !costo.zonas.every(
          (z) =>
            z &&
            typeof z.nombre === "string" &&
            z.nombre.trim().length > 0 &&
            typeof z.monto === "number" &&
            Number.isFinite(z.monto) &&
            z.monto >= 0,
        )
      ) {
        return false;
      }
      break;
    default:
      return false;
  }

  const tiempo = e.tiempo;
  if (!tiempo || typeof tiempo !== "object") return false;
  if (
    typeof tiempo.min !== "number" ||
    typeof tiempo.max !== "number" ||
    !Number.isFinite(tiempo.min) ||
    !Number.isFinite(tiempo.max) ||
    tiempo.min < 0 ||
    tiempo.min > tiempo.max
  ) {
    return false;
  }

  if (e.pedidoMinimo !== undefined && !esMonto(e.pedidoMinimo)) return false;
  /* El horario del reparto se valida en `horario.ts`; aquí solo se comprueba
     que, si viene, sea un objeto. Evitar el import circular no vale la pena:
     quien guarda llama a las dos validaciones. */
  if (e.horario !== undefined && (typeof e.horario !== "object" || e.horario === null)) {
    return false;
  }
  return true;
}

/**
 * El costo del envío para un pedido concreto, o `null` si hay que consultarlo.
 *
 * `subtotal` decide los modos que dependen del pedido (`gratis_desde`). En
 * `zonas` el llamador pasa el monto de la zona elegida y aquí no se adivina.
 */
export function costoEnvio(
  costo: CostoEntrega,
  subtotal: number,
): number | null {
  switch (costo.modo) {
    case "gratis":
      return 0;
    case "consultar":
      return null;
    case "fijo":
      return costo.monto;
    case "gratis_desde":
      return subtotal >= costo.desde ? 0 : costo.monto;
    case "zonas":
      return null;
  }
}
