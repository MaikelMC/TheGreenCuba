import type { UserPlaceMenuItem } from "@/lib/places-store";

/**
 * Novedades de los negocios de pago que se enseñan en el home.
 *
 * Módulo **puro**: lo leen el `PATCH` de `places` para decidir qué guardar y el
 * cliente para pintar el panel. Las ofertas no pasan por aquí —su vigencia vive
 * en `ofertas` y se lee en vivo—; esto solo cubre lo que deja rastro al guardar
 * la carta: productos nuevos y cambios de precio.
 *
 * `actualizacion` existe en el tipo porque la ruta también la genera
 * (reapertura, cambio de horario o de descripción); no sale de `cambiosDeCarta`.
 */

export type TipoNovedadHome =
  | "oferta"
  | "producto_nuevo"
  | "cambio_precio"
  | "actualizacion";

export interface NovedadHome {
  id: string;
  tipo: TipoNovedadHome;
  titulo: string;
  texto?: string;
  negocioId: string;
  negocioNombre: string;
  negocioSlug: string;
  logoUrl?: string;
  categoria?: string;
  imagenUrl?: string;
  productoId?: string;
  productoNombre?: string;
  precioAntes?: string;
  precioAhora?: string;
  /** Metros desde el usuario. Ausente si solo se conoce la provincia. */
  distanciaM?: number;
  createdAt: number;
  /** `/m/{slug}` para lo de la carta; `/place/{id}` para una actualización. */
  href: string;
}

/** Hasta dónde se considera «cerca» para el feed del home. */
export const RADIO_CERCA_M = 10_000;

/** Vida de una novedad de carta. No hay cron: se filtra al leer. */
export const DIAS_NOVEDAD = 14;

/** Tope por negocio, para que uno con veinte productos nuevos no tape al resto. */
export const MAX_POR_NEGOCIO = 3;

/** Tope total, por el mismo motivo con muchos negocios. */
export const MAX_NOVEDADES = 30;

export const ETIQUETA_TIPO: Record<TipoNovedadHome, string> = {
  oferta: "Oferta",
  producto_nuevo: "Nuevo",
  cambio_precio: "Precio",
  actualizacion: "Aviso",
};

export function etiquetaTipo(tipo: TipoNovedadHome): string {
  return ETIQUETA_TIPO[tipo];
}

/** Lo que se guarda como fila de `novedades` al detectar un cambio de carta. */
export interface CambioDeCarta {
  productoId?: string;
  nombre: string;
  imagenUrl?: string;
  precio: string;
  /** Solo en un cambio de precio: el que tenía antes. */
  precioAntes?: string;
}

/**
 * Productos nuevos y precios que cambiaron entre dos versiones de la carta.
 *
 * Se empareja por `id` cuando lo hay y por **nombre normalizado** cuando no:
 * media carta se guardó antes de que los productos tuvieran id, y comparar solo
 * por id diría que una carta vieja entera es nueva en el primer guardado. El
 * precio de emparejar por nombre es que renombrar un producto sin id cuenta
 * como uno nuevo; se acepta, porque el aviso de más solo molesta una vez.
 *
 * Un precio vacío no cuenta como cambio: no hay nada que tachar ni comparar.
 * El orden de salida es el de la carta nueva.
 */
export function cambiosDeCarta(
  previo: readonly UserPlaceMenuItem[] | null | undefined,
  menu: readonly UserPlaceMenuItem[] | null | undefined,
): { productosNuevos: CambioDeCarta[]; cambiosPrecio: CambioDeCarta[] } {
  if (!Array.isArray(menu)) return { productosNuevos: [], cambiosPrecio: [] };

  const porId = new Map<string, UserPlaceMenuItem>();
  const porNombre = new Map<string, UserPlaceMenuItem>();
  for (const item of previo ?? []) {
    if (item.id?.trim()) porId.set(item.id.trim(), item);
    const nombre = normalizar(item.name);
    if (nombre && !porNombre.has(nombre)) porNombre.set(nombre, item);
  }

  const productosNuevos: CambioDeCarta[] = [];
  const cambiosPrecio: CambioDeCarta[] = [];
  const vistos = new Set<string>();

  for (const item of menu) {
    const nombre = item.name?.trim();
    if (!nombre) continue;
    const clave = item.id?.trim() || normalizar(nombre);
    if (vistos.has(clave)) continue;
    vistos.add(clave);

    const antes =
      (item.id ? porId.get(item.id.trim()) : undefined) ??
      porNombre.get(normalizar(nombre));

    if (!antes) {
      productosNuevos.push({
        productoId: item.id,
        nombre,
        imagenUrl: item.image,
        precio: item.price,
      });
      continue;
    }

    const precioAntes = antes.price?.trim();
    const precioAhora = item.price?.trim();
    if (precioAntes && precioAhora && precioAntes !== precioAhora) {
      cambiosPrecio.push({
        productoId: item.id ?? antes.id,
        nombre,
        imagenUrl: item.image,
        precio: precioAhora,
        precioAntes,
      });
    }
  }

  return { productosNuevos, cambiosPrecio };
}

/** Nombre comparable: sin espacios de sobra ni mayúsculas. */
function normalizar(nombre: string | undefined): string {
  return (nombre ?? "").trim().toLowerCase();
}
