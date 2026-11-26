import type { Catalogo, Pack } from "@/lib/plans";
import { nombreServicio } from "@/lib/pack-medida";
import type {
  FacturaConcepto,
  FacturaEstado,
} from "@/lib/db/schema/facturas";

export type { FacturaConcepto, FacturaEstado };

/** Lo que viaja al navegador, sin fechas `Date` ni columnas internas. */
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
  precioUsd: number;
  precioOriginalUsd: number | null;
  descuentoPct: number | null;
  oferta2x1: boolean;
  tasaCup: number | null;
  estado: FacturaEstado;
  pagoId: string | null;
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
  enviada: {
    etiqueta: "Pendiente de aceptar",
    descripcion: "El cliente puede revisar el detalle y confirmar la compra.",
  },
  aceptada: {
    etiqueta: "Aceptada",
    descripcion: "El cliente confirmó la compra. Falta que administración confirme el pago.",
  },
  pagada: {
    etiqueta: "Pagada",
    descripcion: "El pago está confirmado y el servicio fue activado.",
  },
  cancelada: {
    etiqueta: "Cancelada",
    descripcion: "Esta factura ya no se puede usar.",
  },
};

/** El texto del catálogo, una línea por punto y sin vacíos. */
export function lineasDeTexto(texto: string): string[] {
  return texto
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);
}

/**
 * Los conceptos de una factura de pack a medida.
 *
 * Cada servicio elegido es una línea del documento con lo que incluye. Se
 * guardan nombres y textos, no solo claves, porque la factura es histórica y
 * el catálogo puede cambiar mañana.
 */
export function conceptosDePack(
  servicios: readonly string[],
  cat: Catalogo,
): FacturaConcepto[] {
  return servicios.map((clave) => {
    const nombre = nombreServicio(clave, cat);
    if (clave in cat.modulos) {
      const modulo = cat.modulos[clave as keyof typeof cat.modulos];
      return { nombre, detalle: lineasDeTexto(modulo.texto) };
    }
    if (clave in cat.packs) {
      const pack = cat.packs[clave as Pack];
      return { nombre, detalle: lineasDeTexto(pack.texto) };
    }
    return { nombre, detalle: [] };
  });
}

/** El concepto único de una factura de plan estándar. */
export function conceptosDePlan(
  plan: Pack,
  cat: Catalogo,
): FacturaConcepto[] {
  const pack = cat.packs[plan];
  return [{ nombre: pack.nombre, detalle: lineasDeTexto(pack.texto) }];
}

/** USD con dos decimales como mucho, sin arrastrar ceros de más. */
export function formatoUsd(usd: number): string {
  return usd.toLocaleString("es-CU", {
    minimumFractionDigits: Number.isInteger(usd) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
