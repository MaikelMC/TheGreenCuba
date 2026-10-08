/**
 * El pedido por WhatsApp: el carrito convertido en lo que recibe el negocio.
 *
 * Módulo puro a propósito —lo leen el navegador para armar el enlace y las
 * pruebas para comprobarlo— y separado del carrito porque el mensaje es la
 * parte de la que responde el dueño: si sale mal, recibe una lista incompleta o
 * un total que no cuadra y atiende un pedido que no era.
 */

import { whatsappHref } from "./contact-links";
import { currencyLabel, formatMenuPrice } from "./utils";

/** Una línea del carrito: un producto y cuántos van. */
export interface LineaPedido {
  /** Identificador estable del producto dentro de la carta. */
  id: string;
  name: string;
  /** Texto libre, tal como lo escribió el dueño: «1200», «3–5 USD», «Desde 8». */
  price: string;
  currency: string;
  qty: number;
}

/**
 * Lo que cuesta una línea, o `null` si su precio no es una cifra.
 *
 * El precio es texto libre y **no un número** —«3–5 USD» y «Desde 8» son
 * precios de verdad en esta carta—, así que se toma la primera cifra del texto:
 * el suelo de un rango, que es lo mínimo que va a pagar. Un precio sin ninguna
 * cifra —«A convenir»— no suma, en vez de contar cero, que sería un total mal
 * por defecto y en silencio.
 */
export function precioDeLinea(price: string): number | null {
  const cifra = /(\d+(?:[.,]\d+)?)/.exec(price);
  if (!cifra) return null;
  const n = Number(cifra[1]!.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * El total del pedido, o `null` si no se puede calcular.
 *
 * Solo se suma con **una moneda** y con **todas las líneas con cifra**. Un
 * total que mezcle CUP y USD, o que se deje fuera lo que no entendió, es peor
 * que no ponerlo: el dueño lo leería como bueno. Cuando no se puede, el mensaje
 * va sin total —las líneas y las cantidades van igual de completas—.
 */
export function totalDePedido(
  lineas: readonly LineaPedido[],
): { total: number; currency: string } | null {
  const first = lineas[0];
  if (!first) return null;
  const currency = first.currency;
  if (lineas.some((linea) => linea.currency !== currency)) return null;

  let total = 0;
  for (const linea of lineas) {
    const precio = precioDeLinea(linea.price);
    if (precio === null) return null;
    total += precio * linea.qty;
  }
  return { total, currency };
}

/**
 * El texto que se le manda al negocio.
 *
 * Se escribe como se leería en WhatsApp —`*` para la negrita— y cierra con
 * «Pedido desde La Verde», que es lo que le dice al dueño por dónde le entró el
 * pedido y de dónde salió el número.
 */
export function mensajePedido({
  negocio,
  lineas,
}: {
  negocio: string;
  lineas: readonly LineaPedido[];
}): string {
  const cuerpo = lineas.map((linea) => {
    const precio = formatMenuPrice(linea.price, linea.currency);
    return `• ${linea.name} x${linea.qty}${precio ? ` — ${precio}` : ""}`;
  });

  const partes = [`*Pedido — ${negocio}*`, "", ...cuerpo];
  const total = totalDePedido(lineas);
  if (total) {
    partes.push("", `*Total: ${total.total.toFixed(2)} ${currencyLabel(total.currency)}*`);
  }
  partes.push("", "Pedido desde La Verde");
  return partes.join("\n");
}

/** `https://wa.me/<número>?text=<mensaje>` — la URL que abre WhatsApp. */
export function hrefPedido(whatsapp: string, mensaje: string): string {
  const base = whatsappHref(whatsapp);
  return base ? `${base}?text=${encodeURIComponent(mensaje)}` : "";
}
