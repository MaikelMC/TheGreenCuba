import { configEntregaPublica } from "@/lib/entrega-server";
import { configFidelidadDe } from "@/lib/fidelidad-server";
import { tieneFuncion } from "@/lib/plans-server";
import type { ConfigPedido } from "@/lib/pedido";

/**
 * Lo que necesita el carrito para pedir igual que en la carta online: las zonas
 * de domicilio, los pedidos programados y la tarjeta de sellos, resueltos en el
 * servidor contra el plan del negocio.
 *
 * Lo usa la ficha (`/place/[id]`), que antes armaba el WhatsApp a pelo, sin
 * dirección ni entrega ni hora, y sin dejar el pedido en el panel. La carta
 * (`/m/[slug]`) resuelve lo mismo en su propia página.
 */
export async function configPedidoDe(placeId: string): Promise<ConfigPedido> {
  const [configEntrega, tieneProgramados, conTarjeta] = await Promise.all([
    configEntregaPublica(placeId),
    tieneFuncion(placeId, "pedidos_programados"),
    tieneFuncion(placeId, "cliente_frecuente"),
  ]);
  const tarjeta = conTarjeta ? await configFidelidadDe(placeId) : null;
  const meta = tarjeta?.activo ? tarjeta.metas[0] : undefined;

  return {
    configEntrega,
    tieneProgramados,
    fidelidad: meta
      ? { nombre: tarjeta!.nombre, metaSellos: meta.sellos, premio: meta.premio }
      : null,
  };
}
