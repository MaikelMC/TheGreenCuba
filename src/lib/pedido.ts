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
import { aplicarTasa, formatCup, type ConfigTasa } from "./precios";

/** Alfabeto sin 0/O/1/I/L para no confundir en el móvil. 31 caracteres. */
const ALFA_PEDIDO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Código corto de 5 caracteres, único por intento. Se genera en el cliente
 *  y viaja en la cola offline para mantener la idempotencia en reintentos. */
export function generarCodigoPedido(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALFA_PEDIDO[b % ALFA_PEDIDO.length];
  return out;
}

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
export interface EntregaPedido {
  modo: "recogida" | "domicilio";
  /** Nombre de la zona elegida. Ausente si es recogida. */
  zonaNombre?: string;
  /** Costo del envío, ya calculado. `null` = a consultar. */
  costoEnvio: number | null;
  costoEnvioMoneda: string | null;
}

export function mensajePedido({
  negocio,
  lineas,
  direccion,
  configTasa,
  entrega,
  codigo,
  programadoPara,
  programadoFin,
  tarjetaSellos,
}: {
  negocio: string;
  lineas: readonly LineaPedido[];
  /** Dónde se entrega. Vacía o en blanco = sin línea en el mensaje. */
  direccion?: string;
  /** Si hay tasa activa, se añade el equivalente en CUP en cada línea y en el total. */
  configTasa?: ConfigTasa | null;
  /** Datos de entrega calculados. Ausente = sin selector de zona (comportamiento anterior). */
  entrega?: EntregaPedido | null;
  /** Código corto de 5 caracteres. Aparece en la primera línea del mensaje. */
  codigo?: string;
  /** Inicio de la franja programada (UTC). `null` = lo antes posible. */
  programadoPara?: Date | null;
  /** Fin de la franja programada (UTC). */
  programadoFin?: Date | null;
  /** El cliente dejó su teléfono para la tarjeta de sellos. */
  tarjetaSellos?: boolean;
}): string {
  const cuerpo = lineas.map((linea) => {
    const precio = formatMenuPrice(linea.price, linea.currency);
    if (configTasa) {
      const val = precioDeLinea(linea.price);
      let extra = "";
      if (val !== null) {
        if (linea.currency === "USD" || linea.currency === "MLC") {
          extra = ` (${formatCup(aplicarTasa(val, configTasa.tasaUsdCup, configTasa.tasaRedondeo))})`;
        } else if (linea.currency === "CUP") {
          extra = ` (${(val / configTasa.tasaUsdCup).toFixed(2)} USD)`;
        }
      }
      return `• ${linea.name} x${linea.qty}${precio ? ` — ${precio}${extra}` : ""}`;
    }
    return `• ${linea.name} x${linea.qty}${precio ? ` — ${precio}` : ""}`;
  });

  /* ── Cabecera ────────────────────────────────────────────────────────── */
  const encabezado = [`*Pedido — ${negocio}*`];
  if (codigo) encabezado.push(`Pedido #${codigo}`);
  if (programadoPara) {
    const FMT = new Intl.DateTimeFormat("es-CU", {
      timeZone: "America/Havana",
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    const finTxt = programadoFin
      ? ` – ${new Intl.DateTimeFormat("es-CU", {
          timeZone: "America/Havana",
          hour: "2-digit",
          minute: "2-digit",
        }).format(programadoFin)}`
      : "";
    encabezado.unshift(`🕐 *PEDIDO PROGRAMADO — ${FMT.format(programadoPara)}${finTxt}*`);
  }

  const partes = [...encabezado, "", ...cuerpo];

  /* ── Entrega ─────────────────────────────────────────────────────────── */
  if (entrega) {
    if (entrega.modo === "recogida") {
      partes.push("", "*Entrega:* Paso a recoger");
    } else {
      const zonaTxt = entrega.zonaNombre ? ` — ${entrega.zonaNombre}` : "";
      partes.push("", `*Entrega:* A domicilio${zonaTxt}`);
    }
  }
  const dir = direccion?.trim();
  if (dir) partes.push(`*Dirección:* ${dir}`);

  /* La dependienta tiene que saber que este pedido lleva tarjeta: el sello se
     suma al marcarlo entregado, y si no lo marca, el cliente no lo gana. */
  if (tarjetaSellos) partes.push("*Tarjeta de sellos:* sí");

  const total = totalDePedido(lineas);
  if (total || (entrega && entrega.costoEnvio !== null)) {
    partes.push("");
    if (total) {
      partes.push(`Subtotal: ${total.total.toFixed(2)} ${currencyLabel(total.currency)}`);
    }
    if (entrega && entrega.modo === "domicilio") {
      if (entrega.costoEnvio === null) {
        partes.push("Envío: a consultar");
      } else if (entrega.costoEnvio === 0) {
        partes.push("Envío: gratis");
      } else {
        partes.push(`Envío: ${entrega.costoEnvio.toFixed(2)} ${entrega.costoEnvioMoneda ?? ""}`);
      }
    }
    if (total) {
      const totalConEnvio =
        entrega?.modo === "domicilio" && entrega.costoEnvio != null && entrega.costoEnvioMoneda === total.currency
          ? total.total + entrega.costoEnvio
          : total.total;
      if (configTasa && (total.currency === "USD" || total.currency === "MLC")) {
        const totalCup = formatCup(aplicarTasa(totalConEnvio, configTasa.tasaUsdCup, configTasa.tasaRedondeo));
        partes.push(
          `*Total: ${totalConEnvio.toFixed(2)} ${currencyLabel(total.currency)} · ${totalCup}*`,
          `_Tasa usada: ${new Intl.NumberFormat("en-US").format(configTasa.tasaUsdCup)} CUP por USD_`,
        );
      } else {
        partes.push(`*Total: ${totalConEnvio.toFixed(2)} ${currencyLabel(total.currency)}*`);
      }
    }
  }
  partes.push("", "Pedido desde La Verde");
  return partes.join("\n");
}

/** `https://wa.me/<número>?text=<mensaje>` — la URL que abre WhatsApp. */
export function hrefPedido(whatsapp: string, mensaje: string): string {
  const base = whatsappHref(whatsapp);
  return base ? `${base}?text=${encodeURIComponent(mensaje)}` : "";
}
