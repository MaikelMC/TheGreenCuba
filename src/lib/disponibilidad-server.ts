import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { CATALOG_TAG } from "@/lib/db/queries";
import { puede } from "@/lib/plans-server";
import type { Disponibilidad } from "@/lib/disponibilidad";

/**
 * Marca un producto de la carta como disponible o agotado.
 *
 * Es **el único camino que cambia la disponibilidad**, y por eso vive en un
 * servicio de servidor y no dentro de una ruta: el panel del dueño lo usa a
 * través de `/api/places/[id]/disponibilidad`, y el asistente de Telegram lo
 * reusará tal cual —la firma está pensada para eso—. Un solo sitio decide, un
 * solo sitio valida el plan, un solo sitio invalida la caché.
 *
 * Vive en `places.menu` (jsonb): el producto se localiza por su `id` y no por su
 * posición, porque borrar una entrada de en medio correría todos los índices y
 * el asistente marcaría el producto equivocado.
 *
 * El plan se comprueba aquí y no en la ruta: `hoy_hay` entra desde Básico, y un
 * candado que solo se dibuja en el cliente es decoración. La ruta que escribe
 * sigue abierta para quien sepa llamarla, así que la comprobación tiene que
 * estar donde se toca la base.
 */

export type SetDisponibilidadResult =
  | {
      success: true;
      /** El estado **efectivo** tras la escritura, ya resuelto contra `ahora`. */
      agotado: boolean;
      agotadoHasta: number | null;
    }
  | { success: false; error: string; code: "plan" | "no_encontrado" };

export async function setDisponibilidad(
  negocioId: string,
  productoId: string,
  estado: Disponibilidad,
  hasta?: number | null,
): Promise<SetDisponibilidadResult> {
  if (!(await puede(negocioId, "hoy_hay"))) {
    return {
      success: false,
      code: "plan",
      error: "La disponibilidad de productos («Hoy hay») entra con el plan Básico.",
    };
  }

  const [row] = await db
    .select({ menu: places.menu })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);
  if (!row) {
    return { success: false, code: "no_encontrado", error: "Negocio no encontrado." };
  }

  const menu = row.menu ?? [];
  let index = menu.findIndex((item) => item.id === productoId);
  /* Respaldo por posición para las cartas guardadas **antes** de que los
     productos tuvieran id: el panel las siembra con `String(i)` y el asistente
     de Telegram no tiene de dónde sacar otro. En cuanto el dueño guarda la
     carta una vez, el id queda persistido y este camino deja de usarse. */
  if (index === -1 && /^\d+$/.test(productoId)) {
    const asIndex = Number(productoId);
    if (asIndex >= 0 && asIndex < menu.length) index = asIndex;
  }
  if (index === -1) {
    return { success: false, code: "no_encontrado", error: "Producto no encontrado." };
  }

  /* `hasta` solo tiene sentido cuando se agota; al marcar disponible se limpia,
     para no dejar una fecha vieja esperando a la próxima vez que se agote. */
  const agotadoHasta = estado === "agotado" ? (hasta ?? null) : null;
  const next = menu.map((item, i) =>
    i === index ? { ...item, disponibilidad: estado, agotadoHasta } : item,
  );

  await db.update(places).set({ menu: next }).where(eq(places.id, negocioId));

  /* El menú público se sirve cacheado; sin esto el cambio no se ve hasta que
     caduque el TTL. Misma etiqueta que el resto del catálogo. */
  revalidateTag(CATALOG_TAG, "max");

  const agotado =
    estado === "agotado" &&
    !(agotadoHasta != null && agotadoHasta <= Date.now());

  return { success: true, agotado, agotadoHasta };
}
