/**
 * Cálculo del costo de envío para un pedido concreto.
 *
 * Módulo puro: lo usan el carrito (navegador) y la ruta de pedidos (servidor).
 * La lógica vive aquí una sola vez para que el servidor siempre recalcule lo
 * mismo que el cliente mostró, sin depender de lo que mandó el navegador.
 */

import { aplicarTasa, type ConfigTasa } from "@/lib/precios";
import type { EntregaConfig } from "@/lib/ficha/entrega";

export interface ResultadoEntrega {
  /** null = modo «a consultar» o zona no encontrada. */
  costoEnvio: number | null;
  costoEnvioMoneda: string | null;
  envioGratis: boolean;
  cumplePedidoMinimo: boolean;
  /** Cuánto falta para el mínimo, en la moneda del mínimo. 0 si cumple o no hay mínimo. */
  faltaParaMinimo: number;
  /** Nombre de la zona elegida, si aplica. */
  zonaNombre: string | null;
}

export function calcularEntrega({
  subtotal,
  subtotalMoneda,
  modo,
  zonaId,
  entrega,
  configTasa,
}: {
  subtotal: number;
  subtotalMoneda: string;
  modo: "recogida" | "domicilio";
  zonaId?: string;
  entrega: EntregaConfig;
  configTasa?: ConfigTasa | null;
}): ResultadoEntrega {
  // ── Pedido mínimo ────────────────────────────────────────────────────────
  let cumplePedidoMinimo = true;
  let faltaParaMinimo = 0;
  if (entrega.pedidoMinimo) {
    const min = entrega.pedidoMinimo;
    const subtotalConvertido = convertir(subtotal, subtotalMoneda, min.moneda, configTasa);
    if (subtotalConvertido !== null) {
      cumplePedidoMinimo = subtotalConvertido >= min.monto;
      faltaParaMinimo = cumplePedidoMinimo ? 0 : min.monto - subtotalConvertido;
    }
  }

  // ── Recogida: sin envío ──────────────────────────────────────────────────
  if (modo === "recogida") {
    return {
      costoEnvio: 0,
      costoEnvioMoneda: null,
      envioGratis: true,
      cumplePedidoMinimo,
      faltaParaMinimo,
      zonaNombre: null,
    };
  }

  // ── Domicilio ────────────────────────────────────────────────────────────
  const { costo } = entrega;

  if (costo.modo === "gratis") {
    return { costoEnvio: 0, costoEnvioMoneda: null, envioGratis: true, cumplePedidoMinimo, faltaParaMinimo, zonaNombre: null };
  }

  if (costo.modo === "consultar") {
    return { costoEnvio: null, costoEnvioMoneda: null, envioGratis: false, cumplePedidoMinimo, faltaParaMinimo, zonaNombre: null };
  }

  if (costo.modo === "fijo") {
    return { costoEnvio: costo.monto, costoEnvioMoneda: costo.moneda, envioGratis: costo.monto === 0, cumplePedidoMinimo, faltaParaMinimo, zonaNombre: null };
  }

  if (costo.modo === "gratis_desde") {
    // gratis_desde usa su propia moneda como referencia para comparar con el subtotal
    const subtotalConvertido = convertir(subtotal, subtotalMoneda, costo.moneda, configTasa);
    const gratis = subtotalConvertido !== null && subtotalConvertido >= costo.desde;
    return {
      costoEnvio: gratis ? 0 : costo.monto,
      costoEnvioMoneda: costo.moneda,
      envioGratis: gratis,
      cumplePedidoMinimo,
      faltaParaMinimo,
      zonaNombre: null,
    };
  }

  // ── modo zonas ───────────────────────────────────────────────────────────
  if (!zonaId) {
    return { costoEnvio: null, costoEnvioMoneda: null, envioGratis: false, cumplePedidoMinimo, faltaParaMinimo, zonaNombre: null };
  }
  const zona = costo.zonas.find((z) => z.id === zonaId && z.activa);
  if (!zona) {
    return { costoEnvio: null, costoEnvioMoneda: null, envioGratis: false, cumplePedidoMinimo, faltaParaMinimo, zonaNombre: null };
  }
  const monedaZona = zona.moneda || costo.moneda;
  return {
    costoEnvio: zona.monto,
    costoEnvioMoneda: monedaZona,
    envioGratis: zona.monto === 0,
    cumplePedidoMinimo,
    faltaParaMinimo,
    zonaNombre: zona.nombre,
  };
}

/** Convierte `valor` de moneda `de` a moneda `a`. `null` si no hay tasa disponible. */
function convertir(
  valor: number,
  de: string,
  a: string,
  configTasa?: ConfigTasa | null,
): number | null {
  if (de === a) return valor;
  if (!configTasa) return null;
  if ((de === "USD" || de === "MLC") && a === "CUP") {
    return aplicarTasa(valor, configTasa.tasaUsdCup, configTasa.tasaRedondeo);
  }
  if (de === "CUP" && (a === "USD" || a === "MLC")) {
    return valor / configTasa.tasaUsdCup;
  }
  return null;
}
