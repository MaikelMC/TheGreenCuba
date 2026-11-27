import {
  PROPUESTA_MODULOS,
  type Catalogo,
  type ClaveModulo,
  type Pack,
} from "@/lib/plans";
import {
  funcionesDeServicios,
  nombreServicio,
  serviciosEfectivos,
} from "@/lib/pack-medida";
import type {
  FacturaConcepto,
  FacturaEstado,
  FacturaMetodoPago,
} from "@/lib/db/schema/facturas";

export type { FacturaConcepto, FacturaEstado, FacturaMetodoPago };

/** Lo que viaja al navegador, sin fechas `Date` ni columnas internas. */
export interface ReembolsoFactura {
  id: string;
  montoCentavos: number;
  motivo: string;
  reembolsadoEn: string;
  registradoPorNombre: string;
}

export interface FacturaResumen {
  id: string;
  negocioId: string;
  negocioNombre: string;
  tipo: "pack_medida" | "plan";
  packId: string | null;
  planClave: string | null;
  titulo: string;
  conceptos: FacturaConcepto[];
  nota: string | null;
  notaAutor: string | null;
  precioUsd: number;
  /** Suma de los precios de lista; `null` si algún módulo no tenía precio. */
  precioSeparadoUsd: number | null;
  precioOriginalUsd: number | null;
  descuentoPct: number | null;
  oferta2x1: boolean;
  tasaCup: number | null;
  estado: FacturaEstado;
  expiraEn: string | null;
  metodoPago: FacturaMetodoPago | null;
  avisoPagoEn: string | null;
  numeroFactura: number | null;
  pagoId: string | null;
  /** El reembolso, si la factura ya se devolvió. Solo lo carga el panel. */
  reembolso: ReembolsoFactura | null;
  enviadaEn: string;
  aceptadaEn: string | null;
  pagadaEn: string | null;
  canceladaEn: string | null;
  creadoEn: string;
}

export const FACTURA_ESTADO: Record<
  FacturaEstado,
  { etiqueta: string; descripcion: string }
> = {
  pendiente: {
    etiqueta: "Pendiente de aceptar",
    descripcion: "El negocio puede revisar el detalle y aceptar la propuesta.",
  },
  aceptada: {
    etiqueta: "Aceptada · falta el pago",
    descripcion:
      "El negocio aceptó. Ahora elige cómo pagar y avisa cuando lo haga.",
  },
  en_revision: {
    etiqueta: "Pago en revisión",
    descripcion:
      "El negocio avisó de que pagó. Administración lo confirma en menos de 24 h.",
  },
  pagada: {
    etiqueta: "Pagada · activo",
    descripcion: "El pago está confirmado y los servicios están activos.",
  },
  reembolsada: {
    etiqueta: "Reembolsada",
    descripcion: "Se devolvió el importe y quedó registrado en Ingresos.",
  },
  caducada: {
    etiqueta: "Caducada",
    descripcion: "Pasó la fecha de validez sin que la propuesta se aceptara.",
  },
  cancelada: {
    etiqueta: "Cancelada",
    descripcion: "Esta propuesta ya no se puede usar.",
  },
};

export const METODO_PAGO: Record<
  FacturaMetodoPago,
  { etiqueta: string; descripcion: string }
> = {
  qvapay: {
    etiqueta: "QvaPay",
    descripcion: "En USD · se activa al confirmarse",
  },
  transferencia: {
    etiqueta: "Transferencia en CUP",
    descripcion: "Los datos te los damos por WhatsApp",
  },
  efectivo: {
    etiqueta: "Efectivo",
    descripcion: "Solo en Santiago de Cuba",
  },
};

/** Valida un método de pago que llega del navegador. */
export function esMetodoPago(valor: unknown): valor is FacturaMetodoPago {
  return valor === "qvapay" || valor === "transferencia" || valor === "efectivo";
}

/**
 * El estado que se muestra. Una propuesta pendiente cuya fecha límite pasó se
 * lee como caducada sin necesidad de escribir en la base; si un cron la marca,
 * el estado guardado coincide.
 */
export function estadoEfectivo(
  estado: FacturaEstado,
  expiraEn: string | null,
  ahora: Date = new Date(),
): FacturaEstado {
  if (estado !== "pendiente" || !expiraEn) return estado;
  return new Date(expiraEn).getTime() < ahora.getTime() ? "caducada" : estado;
}

/** La validez configurable, en días. 7 hasta que se acuerde otra cifra. */
export const DIAS_VALIDEZ_PROPIOS = 7;

/** Lee `FACTURA_DIAS_VALIDEZ` sin dejar que un valor roto acorte la validez. */
export function diasValidezDesde(valor: string | undefined): number {
  const dias = Number(valor);
  return Number.isInteger(dias) && dias > 0 && dias <= 365
    ? dias
    : DIAS_VALIDEZ_PROPIOS;
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 86_400_000);
}

const FECHA_HAVANA = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Havana",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** El día natural en La Habana, como `YYYY-MM-DD`. */
export function fechaHavanaISO(fecha: Date): string {
  const partes = FECHA_HAVANA.formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

/** Suma meses de calendario a una fecha `YYYY-MM-DD`, ajustando el fin de mes. */
export function sumarMesesISO(iso: string, meses: number): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  if (!anio || !mes || !dia) return iso;

  const base = new Date(Date.UTC(anio, mes - 1, dia));
  const diaOriginal = base.getUTCDate();
  base.setUTCDate(1);
  base.setUTCMonth(base.getUTCMonth() + meses);
  const ultimoDia = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
  ).getUTCDate();
  base.setUTCDate(Math.min(diaOriginal, ultimoDia));
  return base.toISOString().slice(0, 10);
}

function restarDiaISO(iso: string): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  if (!anio || !mes || !dia) return iso;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() - 1);
  return fecha.toISOString().slice(0, 10);
}

export interface PeriodoPago {
  /** Primer día cubierto, en La Habana. */
  inicio: string;
  /** Último día cubierto. */
  fin: string;
  /** El día en que toca el siguiente cobro. */
  proximoCobro: string;
  /** 2 con el 2×1 del primer pago; 1 sin la oferta. */
  meses: number;
}

/**
 * El periodo que cubre un pago y cuándo toca el siguiente.
 *
 * Se calcula sobre el calendario de La Habana, no sobre el huso del servidor:
 * un pago a las 21:00 del 26 en Cuba ya es día 27 en UTC, y la factura no
 * puede decir que empieza un día que el negocio no ha vivido.
 */
export function periodoDePago(
  desde: Date,
  oferta2x1: boolean,
): PeriodoPago {
  const meses = oferta2x1 ? 2 : 1;
  const inicio = fechaHavanaISO(desde);
  const proximoCobro = sumarMesesISO(inicio, meses);
  return {
    inicio,
    fin: restarDiaISO(proximoCobro),
    proximoCobro,
    meses,
  };
}

/** La proyección que se enseña antes de pagar: mismo cálculo, desde hoy. */
export function periodoProyectado(
  ahora: Date,
  oferta2x1: boolean,
): PeriodoPago {
  return periodoDePago(ahora, oferta2x1);
}

/** El texto del catálogo, una línea por punto y sin vacíos. */
export function lineasDeTexto(texto: string): string[] {
  return texto
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);
}

/**
 * El precio de lista de los servicios elegidos.
 *
 * Es la referencia de «Por separado costaría». El Menú Pro que ya trae
 * «Reservas y pedidos» no se suma dos veces. Devuelve `null` en cuanto una
 * clave no tiene precio en el catálogo: es preferible no enseñar la fila a
 * enseñar una suma incompleta.
 */
export function precioSeparado(
  servicios: readonly string[],
  cat: Catalogo,
): number | null {
  const claves = serviciosEfectivos([...servicios]);
  const modulos = cat.modulos as Record<string, { usd: number } | undefined>;
  const packs = cat.packs as Record<string, { usd: number } | undefined>;

  let total = 0;
  for (const clave of claves) {
    const precio = modulos[clave]?.usd ?? packs[clave]?.usd;
    if (
      typeof precio !== "number" ||
      !Number.isFinite(precio) ||
      precio < 0
    ) {
      return null;
    }
    total += precio;
  }

  return Math.round(total * 100) / 100;
}

const MARCA_PROXIMAMENTE = /\s*\(pr[oó]ximamente\)\s*$/i;

/**
 * Separa las líneas de un texto del catálogo en lo que se vende y lo que no.
 *
 * Las líneas «(próximamente)» salen de la lista; «Requiere…» no es una
 * ventaja y se descarta (la dependencia se cuenta aparte); «Todo el Menú Pro»
 * pasa a nota.
 */
function separarLineas(lineas: readonly string[]): {
  detalle: string[];
  proximamente: string[];
  nota?: string;
} {
  const detalle: string[] = [];
  const proximamente: string[] = [];
  let nota: string | undefined;
  for (const linea of lineas) {
    if (MARCA_PROXIMAMENTE.test(linea)) {
      proximamente.push(linea.replace(MARCA_PROXIMAMENTE, ""));
    } else if (/^requiere\b/i.test(linea)) {
      continue;
    } else if (/^todo el men[uú] pro$/i.test(linea)) {
      nota = "Incluye todo lo de Menú Pro.";
    } else {
      detalle.push(linea);
    }
  }
  return { detalle, proximamente, nota };
}

/**
 * Un concepto guardado, leído con las reglas de hoy.
 *
 * Las propuestas emitidas antes del rediseño guardaron el texto del catálogo
 * tal cual, con «Requiere el módulo…» y «(próximamente)» como líneas. Se
 * limpian al servir, sin tocar la fila: el enlace sigue abriendo y ya no
 * promete lo que no está en producción.
 */
export function normalizarConcepto(concepto: FacturaConcepto): FacturaConcepto {
  const { detalle, proximamente, nota } = separarLineas(concepto.detalle);
  const todasProximamente = [...(concepto.proximamente ?? []), ...proximamente];
  return {
    ...concepto,
    detalle,
    nota: concepto.nota ?? nota,
    proximamente: todasProximamente.length > 0 ? todasProximamente : undefined,
  };
}

/** Las funciones de un módulo que todavía no están en producción. */
function funcionesNoDisponibles(clave: ClaveModulo, cat: Catalogo): string[] {
  return cat.modulos[clave].funciones
    .filter((f) => !cat.funciones[f].disponible)
    .map((f) => cat.funciones[f].texto);
}

/**
 * Las dependencias que el pack no cumple, como frases para el administrador.
 *
 * Un módulo con `requiere` necesita que el pack traiga todas las funciones del
 * módulo requerido, ya sea con ese módulo o con un pack estándar que las
 * incluya. Vacío = se puede emitir.
 */
export function dependenciasSinCumplir(
  servicios: readonly string[],
  cat: Catalogo,
): string[] {
  const tiene = new Set<string>(funcionesDeServicios([...servicios], cat));
  const faltan: string[] = [];
  for (const clave of servicios) {
    if (!(clave in cat.modulos)) continue;
    const requiere = PROPUESTA_MODULOS[clave as ClaveModulo].requiere;
    if (!requiere) continue;
    const cubierto = cat.modulos[requiere].funciones.every((f) => tiene.has(f));
    if (!cubierto) {
      faltan.push(
        `«${cat.modulos[clave as ClaveModulo].nombre}» requiere «${cat.modulos[requiere].nombre}».`,
      );
    }
  }
  return faltan;
}

/**
 * Los conceptos de una factura de pack a medida.
 *
 * Cada servicio elegido es una fila con su beneficio y sus detalles. Se guardan
 * textos, no solo claves, porque la factura es histórica y el catálogo puede
 * cambiar mañana. Lo que no está en producción va en `proximamente`.
 */
export function conceptosDePack(
  servicios: readonly string[],
  cat: Catalogo,
): FacturaConcepto[] {
  return servicios.map((clave) => {
    const nombre = nombreServicio(clave, cat);
    if (clave in cat.modulos) {
      const modulo = cat.modulos[clave as ClaveModulo];
      const propuesta = PROPUESTA_MODULOS[clave as ClaveModulo];
      const proximamente = [
        ...funcionesNoDisponibles(clave as ClaveModulo, cat),
        ...(propuesta.proximamente ?? []),
      ];
      const nota = propuesta.requiere
        ? `Funciona junto con ${cat.modulos[propuesta.requiere].nombre} (incluido).`
        : propuesta.nota;
      return {
        nombre,
        beneficio: propuesta.beneficio,
        detalle: [...propuesta.detalles],
        ...(nota ? { nota } : {}),
        ...(proximamente.length > 0 ? { proximamente } : {}),
        precioUsd: modulo.usd,
      };
    }
    if (clave in cat.packs) {
      return conceptoDePack(clave as Pack, cat);
    }
    return { nombre, detalle: [] };
  });
}

function conceptoDePack(plan: Pack, cat: Catalogo): FacturaConcepto {
  const pack = cat.packs[plan];
  const { detalle, proximamente } = separarLineas(lineasDeTexto(pack.texto));
  const noDisponibles = pack.funciones
    .filter((f) => !cat.funciones[f].disponible)
    .map((f) => cat.funciones[f].texto);
  const todas = [...new Set([...proximamente, ...noDisponibles])];
  /* La línea de una función que no existe todavía tampoco va en la lista. */
  const sinProximas = detalle.filter((linea) => !noDisponibles.includes(linea));
  return {
    nombre: pack.nombre,
    beneficio: pack.lema,
    detalle: sinProximas,
    ...(todas.length > 0 ? { proximamente: todas } : {}),
    precioUsd: pack.usd,
  };
}

/** El concepto único de una factura de plan estándar. */
export function conceptosDePlan(
  plan: Pack,
  cat: Catalogo,
): FacturaConcepto[] {
  return [conceptoDePack(plan, cat)];
}

/** Lo «próximamente» de todos los conceptos, sin repetir. */
export function proximamenteDe(conceptos: readonly FacturaConcepto[]): string[] {
  return [...new Set(conceptos.flatMap((c) => c.proximamente ?? []))];
}

/* ── El dinero en el documento ──────────────────────────────────────────────
   `es-CU` en el ICU de Node y de los navegadores agrupa con coma y separa los
   decimales con punto («5,695.832»): es justo la mezcla que confundía. Aquí se
   escribe a mano y siempre igual: miles con espacio fino que no se parte
   (U+202F) y decimales con coma. */

const ESPACIO_FINO = " ";

function agruparMiles(entero: number): string {
  return String(Math.abs(entero)).replace(/\B(?=(\d{3})+(?!\d))/g, ESPACIO_FINO);
}

/** «5», «3,50», «1 200». Sin decimales si es entero; con dos si no. */
export function formatoUsd(usd: number): string {
  const centavos = Math.round(usd * 100);
  const signo = centavos < 0 ? "-" : "";
  const entero = Math.trunc(Math.abs(centavos) / 100);
  const resto = Math.abs(centavos) % 100;
  return resto === 0
    ? `${signo}${agruparMiles(entero)}`
    : `${signo}${agruparMiles(entero)},${String(resto).padStart(2, "0")}`;
}

/** Pesos enteros, nunca con decimales: «5 696». */
export function formatoCup(cup: number): string {
  const redondeado = Math.round(cup);
  return `${redondeado < 0 ? "-" : ""}${agruparMiles(redondeado)}`;
}

/** El importe en CUP de un precio en USD a una tasa dada. */
export function usdACup(usd: number, tasa: number): number {
  return Math.round(usd * tasa);
}

/**
 * El mensaje que abre WhatsApp cuando el negocio paga por transferencia.
 *
 * Lleva el detalle de la factura para que soporte compruebe que es real antes
 * de dictar la tarjeta: sin la referencia y el enlace, cualquiera podría pedir
 * los datos de cobro usando el nombre de La Verde. Pide además el importe
 * exacto en CUP, que depende de la tasa del día en que se transfiere.
 */
export function mensajeTransferenciaCup(input: {
  id: string;
  negocioNombre: string;
  precioUsd: number;
  cup: number | null;
  enlace: string;
  /** La fecha del documento, ya escrita para leerse. */
  fecha?: string;
}): string {
  const importe = `${formatoUsd(input.precioUsd)} USD${
    input.cup !== null ? ` (≈ ${formatoCup(input.cup)} CUP)` : ""
  }`;

  return [
    "Hola, quiero pagar un pack de La Verde por transferencia en CUP.",
    "",
    `Factura: ${input.id}`,
    `Negocio: ${input.negocioNombre}`,
    `Importe: ${importe}`,
    ...(input.fecha ? [`Fecha: ${input.fecha}`] : []),
    `Enlace: ${input.enlace}`,
    "",
    "¿Me confirman que esta factura es real y me envían los datos para hacer la transferencia (tarjeta, titular e importe exacto en CUP)?",
  ].join("\n");
}


const DIA_MES = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  timeZone: "America/Havana",
});

/** «26 nov», sin el punto que algunos ICU añaden a la abreviatura. */
export function fechaCorta(fecha: Date): string {
  return DIA_MES.format(fecha).replace(".", "");
}

/**
 * La línea de la tasa debajo del importe.
 * Antes de pagar: «Tasa del 26 nov: 1 139 CUP por USD».
 * Con la factura pagada: «Tasa aplicada: 1 139 CUP por USD».
 */
export function lineaTasa(
  tasa: number,
  fecha: Date,
  aplicada = false,
): string {
  const valor = `${formatoCup(tasa)} CUP por USD`;
  return aplicada
    ? `Tasa aplicada: ${valor}`
    : `Tasa del ${fechaCorta(fecha)}: ${valor}`;
}
