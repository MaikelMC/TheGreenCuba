import { puede } from "@/lib/plans-server";
import { setDisponibilidadProducto } from "@/lib/productos-escritura";
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
 * El plan se comprueba aquí y no en la ruta: `hoy_hay` entra con el módulo Menú
 * Pro, y un candado que solo se dibuja en el cliente es decoración. La ruta que
 * escribe sigue abierta para quien sepa llamarla, así que la comprobación tiene
 * que estar donde se toca la base.
 */

export type SetDisponibilidadResult =
  | {
      success: true;
      /** El estado **efectivo** tras la escritura, ya resuelto contra `ahora`. */
      agotado: boolean;
      agotadoHasta: number | null;
      /** La versión nueva del producto, para que el panel no la vea como ajena. */
      version: number;
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
      error:
        "La disponibilidad de productos («Hoy hay») entra con el módulo Menú Pro.",
    };
  }

  /* Fase C: la disponibilidad vive en la fila del producto, en `productos`.
     Se señala **por id** y nada más: el respaldo por posición que tenía el
     jsonb desapareció con la migración, que dio un id estable a cada producto.
     `places.menu` ya no se escribe. */
  const agotadoHasta = estado === "agotado" ? (hasta ?? null) : null;
  const escrito = await setDisponibilidadProducto(negocioId, productoId, estado, agotadoHasta);
  if (!escrito.ok) {
    return { success: false, code: "no_encontrado", error: "Producto no encontrado." };
  }

  const agotado =
    estado === "agotado" &&
    !(agotadoHasta != null && agotadoHasta <= Date.now());

  return { success: true, agotado, agotadoHasta, version: escrito.version };
}
