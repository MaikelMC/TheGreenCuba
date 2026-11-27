/**
 * Pack a medida: lógica pura y tipos compartidos.
 *
 * Este archivo es puro —no importa la base de datos— para que lo lean tanto
 * el servidor como el navegador. Las funciones que tocan la base viven en
 * `src/app/api/admin/packs-medida/` y en `src/app/api/business/packs-medida/`.
 */

import {
  CATALOGO,
  type Catalogo,
  type ClaveModulo,
  type Funcion,
  type Pack,
} from "@/lib/plans";
import { whatsappHref } from "@/lib/contact-links";
import { SUPPORT_WHATSAPP } from "@/lib/legal";
import type { PackMedidaEstado } from "@/lib/db/schema/packs_medida";

export type { PackMedidaEstado };

/* ── Servicios que ya vienen dentro de otro ─────────────────────────────── */

/** El catálogo suelto: se vende aparte para quien no quiere pedidos. */
export const MENU_PRO = "menu_pro";

/** El módulo que trae «Todo el Menú Pro» dentro. */
export const PEDIDOS_RESERVAS = "pedidos_reservas";

/**
 * Si la lista elegida ya trae el Menú Pro dentro.
 *
 * «Reservas y pedidos» incluye el Menú Pro entero (catálogo, QR, fotos
 * ilimitadas, ofertas), así que marcar los dos y cobrarlos por separado es
 * cobrar dos veces lo mismo. La tarjeta de Menú Pro se mantiene suelta para
 * quien solo quiere catálogo, sin pedidos.
 */
export function menuProIncluido(servicios: readonly string[]): boolean {
  return servicios.includes(PEDIDOS_RESERVAS);
}

/**
 * La lista de servicios sin el Menú Pro cuando ya va incluido, y sin repetidos.
 *
 * Es lo que se guarda y lo que se suma: si viene «Reservas y pedidos»,
 * «Menú Pro» sobra. Sin pedidos, Menú Pro sigue siendo un servicio con su
 * precio propio.
 */
export function serviciosEfectivos(servicios: readonly string[]): string[] {
  const unicos = [...new Set(servicios)];
  return menuProIncluido(unicos) ? unicos.filter((s) => s !== MENU_PRO) : unicos;
}

/* ── Precio sugerido ────────────────────────────────────────────────────── */

export interface PrecioSugerido {
  /** Suma de precios de lista de cada módulo o pack elegido. */
  precioUsd: number;
  /**
   * Notas que el administrador debe leer: se producen cuando un servicio
   * elegido es un pack estándar completo en vez de un módulo suelto.
   */
  notas: string[];
}

/**
 * El precio de lista de los servicios elegidos, sin contar dos veces el
 * mismo ítem.
 *
 * `servicios` puede mezclar claves de `MODULOS` y de `PACKS`. Para los
 * módulos sueltos se suma directamente su precio. Para los packs estándar
 * se suma el precio del pack y se añade una nota al administrador.
 *
 * El Menú Pro que ya trae «Reservas y pedidos» no se suma otra vez.
 *
 * Esta función es la referencia del formulario: el admin ve lo que costaría
 * contratar esos servicios por separado y fija el precio final a mano.
 */
export function precioSugeridoPack(
  servicios: string[],
  cat: Catalogo = CATALOGO,
): PrecioSugerido {
  const todas = [...new Set(servicios)];
  const claves = serviciosEfectivos(todas);
  const clavesMod = new Set(Object.keys(cat.modulos));
  const clavesPack = new Set(Object.keys(cat.packs));

  let precioUsd = 0;
  const notas: string[] = [];

  /* El dueño puede haber marcado Menú Pro y Reservas y pedidos a la vez: el
     segundo ya lo trae, así que solo se cobra una vez y se avisa. */
  if (todas.includes(MENU_PRO) && menuProIncluido(todas)) {
    notas.push(
      `«${cat.modulos.menu_pro.nombre}» va incluido en «${cat.modulos.pedidos_reservas.nombre}»: no se suma aparte.`,
    );
  }

  for (const clave of claves) {
    if (clavesMod.has(clave)) {
      precioUsd += cat.modulos[clave as ClaveModulo].usd;
    } else if (clavesPack.has(clave)) {
      const pack = cat.packs[clave as Pack];
      precioUsd += pack.usd;
      notas.push(
        `«${pack.nombre}» es un pack estándar completo ($${pack.usd}/mes); se usó su precio íntegro.`,
      );
    }
  }

  return { precioUsd: Math.round(precioUsd * 100) / 100, notas };
}

/**
 * El nombre visible de un servicio del pack.
 *
 * Los packs guardan claves (`menu_pro`, `esencial`) y la interfaz no debe
 * enseñar la clave: si el catálogo cambió y ya no existe, se cae a la clave
 * para no romper una fila histórica.
 */
export function nombreServicio(
  clave: string,
  cat: Catalogo = CATALOGO,
): string {
  if (clave in cat.modulos) return cat.modulos[clave as ClaveModulo].nombre;
  if (clave in cat.packs) return cat.packs[clave as Pack].nombre;
  return clave;
}

/* ── Funciones resultantes ──────────────────────────────────────────────── */

/**
 * Todas las funciones que cubre la lista de servicios elegidos.
 *
 * Se calcula en el servidor al guardar el pack y se guarda en
 * `packs_medida.funciones` como foto del momento: si mañana cambia el
 * catálogo, el pack ya pagado no cambia.
 */
export function funcionesDeServicios(
  servicios: string[],
  cat: Catalogo = CATALOGO,
): Funcion[] {
  const claves = [...new Set(servicios)];
  const clavesMod = new Set(Object.keys(cat.modulos));
  const funcSet = new Set<Funcion>();

  for (const clave of claves) {
    if (clavesMod.has(clave)) {
      for (const f of cat.modulos[clave as ClaveModulo].funciones) {
        funcSet.add(f);
      }
    } else if (clave in cat.packs) {
      for (const f of cat.packs[clave as Pack].funciones) {
        funcSet.add(f);
      }
    }
  }

  return [...funcSet];
}

/* ── Vigencia ───────────────────────────────────────────────────────────── */

/**
 * La fecha hasta la que queda vigente el pack tras un pago.
 *
 * - Primer pago con 2×1: `desde` + 60 días.
 * - Primer pago sin oferta: `desde` + 30 días.
 * - Renovación (pack aún vigente): `venceEnActual` + 30 días.
 * - Renovación caducada: `desde` + 30 días.
 */
export function calcularVencimiento({
  desde,
  oferta2x1,
  venceEnActual,
}: {
  desde: Date;
  oferta2x1: boolean;
  venceEnActual: Date | null;
}): Date {
  const esPrimerPago = !venceEnActual;

  if (esPrimerPago) {
    return new Date(desde.getTime() + (oferta2x1 ? 60 : 30) * 86_400_000);
  }

  /* Renovación: suma sobre el vencimiento actual si aún no expiró. */
  const base = venceEnActual.getTime() > desde.getTime() ? venceEnActual : desde;
  return new Date(base.getTime() + 30 * 86_400_000);
}

/* ── Tipos para el panel del negocio ────────────────────────────────────── */

/**
 * Lo que el panel del negocio necesita para mostrar la tarjeta del pack.
 *
 * Viajan strings en vez de Dates porque Next.js serializa las props de
 * componentes de cliente y los objetos Date no se serializan solos.
 * Las fechas se reciben como ISO y se convierten al pintar.
 */
export interface PackMedidaResumen {
  id: string;
  estado: PackMedidaEstado;
  /** Claves de módulos/packs elegidas por el administrador. */
  servicios: string[];
  /** Funciones que otorga el pack (foto del momento). */
  funciones: string[];
  /** `null` mientras el pack está solicitado o en borrador y aún no tiene precio. */
  precioUsd: number | null;
  oferta2x1: boolean;
  notaCliente: string | null;
  venceEn: string | null;
  enviadoEn: string | null;
  pagadoEn: string | null;
}

/* ── Helpers de UI ──────────────────────────────────────────────────────── */

/**
 * El enlace de WhatsApp preescrito para «Tengo una duda sobre mi pack».
 * Se abre en el navegador del dueño; el texto llega listo al agente de soporte.
 */
export function enlaceDudaPack(negocioNombre: string, packId: string): string {
  const texto = `Hola, tengo una duda sobre el pack a medida de «${negocioNombre}» (ref: ${packId})`;
  return `${whatsappHref(SUPPORT_WHATSAPP)}?text=${encodeURIComponent(texto)}`;
}

/**
 * La fecha de vencimiento que se muestra al dueño si paga ahora.
 *
 * Se usa en la frase «Hoy pagas X. Tu pack queda activo hasta el {fecha}».
 * No es la fecha real (aún no se pagó), sino la proyección.
 */
export function fechaVencimientoProyectada(oferta2x1: boolean): Date {
  return new Date(Date.now() + (oferta2x1 ? 60 : 30) * 86_400_000);
}
