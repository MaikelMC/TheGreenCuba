/**
 * El pedido revisado contra la carta, en el servidor (fase C).
 *
 * El carrito vive en el navegador y lo que manda al guardar el pedido —nombre,
 * precio y cantidad de cada línea— no es de fiar: puede venir de una carta
 * vieja guardada en el móvil o de una petición hecha a mano. Aquí cada línea se
 * contrasta con el producto de la tabla y el precio que queda guardado es **el
 * del servidor**: el numérico del producto o, si hay una oferta viva, el de la
 * oferta.
 *
 * **Nada se rechaza.** El POST no bloquea el WhatsApp: el pedido ya le llegó al
 * dueño por ahí, y rechazarlo aquí solo serviría para que no quedara en su panel
 * (sin registro ni sello). Lo raro se guarda igual y se marca para revisar:
 *
 * - `no_existe`: la línea apunta a un producto que ya no está en la carta;
 * - `oculto`: el producto está oculto;
 * - `agotado`: el producto está agotado ahora (el cliente pudo cargar la carta
 *   antes de que se agotara);
 * - `precio_cambio`: el precio del mensaje no es el del servidor —en `price`
 *   se guarda el del servidor y en `precioCliente` el que vio el cliente—;
 * - `sin_precio`: el producto no tiene precio numérico y el total no se puede
 *   comprobar.
 *
 * Módulo puro: sin base de datos, para poder probarlo.
 */

import { estaAgotado } from "./disponibilidad";
import { ofertaDe, parsePrecio, precioConOferta } from "./ofertas";
import { precioDeLinea, type LineaPedido } from "./pedido";
import { convertirPrecio } from "./productos";
import type { UserPlaceMenuItem, UserPlaceOferta } from "./places-store";

export type MotivoRevision =
  | "no_existe"
  | "oculto"
  | "agotado"
  | "precio_cambio"
  | "sin_precio";

/** Sin acentos y en minúsculas: «Café» y «cafe» son el mismo producto. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/**
 * El precio de un producto según el servidor, o `null` si no es una cifra.
 *
 * Con una oferta viva manda el precio rebajado; si la rebaja no se puede
 * calcular (un porcentaje sobre un rango, por ejemplo), el del producto.
 */
export function precioDelServidor(
  producto: UserPlaceMenuItem,
  ofertas: UserPlaceOferta[],
  ahora: number,
): number | null {
  const oferta = producto.id ? ofertaDe(ofertas, producto.id, ahora) : undefined;
  if (oferta) {
    const par = precioConOferta(producto.price, oferta);
    const rebajado = par ? parsePrecio(par.por) : null;
    if (rebajado !== null) return rebajado;
  }
  return convertirPrecio(producto.price, producto.currency, producto.tipoPrecio).precio;
}

/** Dos precios iguales a efectos del pedido: al céntimo. */
function mismoPrecio(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

/** Una cifra como texto, sin ceros de más: «250», «3.5». */
function textoPrecio(valor: number): string {
  return String(Math.round(valor * 100) / 100);
}

/**
 * Las líneas con el precio del servidor y los motivos para revisar el pedido.
 *
 * Cada línea se busca por id y, si no aparece, por nombre (un carrito guardado
 * antes de la migración lleva los ids viejos). La cantidad no se toca.
 */
export function revisarPedido(
  lineas: readonly LineaPedido[],
  carta: readonly UserPlaceMenuItem[],
  ofertas: UserPlaceOferta[],
  ahora: number = Date.now(),
): { lineas: LineaPedido[]; motivos: MotivoRevision[] } {
  const porId = new Map(carta.filter((p) => p.id).map((p) => [p.id!, p]));
  const porNombre = new Map(carta.map((p) => [normalizar(p.name), p]));
  const motivos = new Set<MotivoRevision>();

  const revisadas = lineas.map((linea) => {
    const producto = porId.get(linea.id) ?? porNombre.get(normalizar(linea.name));
    if (!producto) {
      motivos.add("no_existe");
      return linea;
    }
    if (producto.oculto) motivos.add("oculto");
    if (estaAgotado(producto, ahora)) motivos.add("agotado");

    const servidor = precioDelServidor(producto, ofertas, ahora);
    if (servidor === null) {
      motivos.add("sin_precio");
      return { ...linea, id: producto.id ?? linea.id, currency: producto.currency };
    }

    const cliente = precioDeLinea(linea.price);
    const cambio =
      cliente === null || !mismoPrecio(cliente, servidor) || linea.currency !== producto.currency;
    if (cambio) motivos.add("precio_cambio");
    return {
      ...linea,
      id: producto.id ?? linea.id,
      price: textoPrecio(servidor),
      currency: producto.currency,
      /* Lo que vio el cliente se guarda junto al precio del servidor: la
         dependienta decide qué cobrar con los dos delante. */
      ...(cambio
        ? {
            precioCliente: linea.price,
            ...(linea.currency !== producto.currency ? { monedaCliente: linea.currency } : {}),
          }
        : {}),
    };
  });

  return { lineas: revisadas, motivos: [...motivos] };
}
