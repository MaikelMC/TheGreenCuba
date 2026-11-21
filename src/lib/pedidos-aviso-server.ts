import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businessOwners, places } from "@/lib/db/schema";
import { normalizarPermisos } from "@/lib/permisos-negocio";
import { enviarPushAUsuarios } from "@/lib/push-server";

/**
 * El push de «pedido nuevo» al dueño y a los trabajadores que atienden pedidos.
 *
 * Lo llama `POST /api/pedidos` **después** de contestar al cliente (`after()`),
 * así que nada de aquí puede frenar ni tumbar el pedido: se traga cualquier
 * error y deja rastro en el log, sin datos del cliente.
 *
 * Coste: una consulta por los destinatarios (pocas filas, por índice de
 * negocio), otra por el nombre, y un envío por suscripción guardada. Un negocio
 * típico son uno o dos teléfonos por pedido. `enviarPushAUsuarios` borra las
 * suscripciones muertas (404/410) para no volver a pagarlas.
 */
export async function avisarPedidoNuevo(
  placeId: string,
  pedidoId: string,
  codigo: string | null,
): Promise<void> {
  try {
    const [filas, [negocio]] = await Promise.all([
      db
        .select({
          userId: businessOwners.userId,
          role: businessOwners.role,
          permisos: businessOwners.permissions,
        })
        .from(businessOwners)
        .where(eq(businessOwners.placeId, placeId)),
      db.select({ nombre: places.name }).from(places).where(eq(places.id, placeId)).limit(1),
    ]);

    const destinatarios = filas
      .filter((f) => f.role === "owner" || normalizarPermisos(f.permisos).includes("pedidos"))
      .map((f) => f.userId);
    if (destinatarios.length === 0) return;

    const params = new URLSearchParams({ negocio: placeId, seccion: "pedidos", pedido: pedidoId });
    await enviarPushAUsuarios(destinatarios, {
      title: codigo ? `Pedido nuevo #${codigo}` : "Pedido nuevo",
      body: `${negocio?.nombre ?? "Tu negocio"}: tienes un pedido por atender.`,
      url: `/business?${params.toString()}`,
      tag: `pedido-${pedidoId}`,
    });
  } catch (error) {
    console.error("[pedidos] no se pudo avisar del pedido nuevo", {
      placeId,
      pedidoId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
