import { NextRequest, NextResponse } from "next/server";
import { canManagePlace, respuestaSinAcceso } from "@/lib/admin-server";
import {
  borrarCliente,
  configFidelidadDe,
  detalleCliente,
} from "@/lib/fidelidad-server";
import { enmascararTelefono } from "@/lib/telefono";

type Params = { params: Promise<{ id: string; clienteId: string }> };

/** La tarjeta de un cliente, con su historial de movimientos. */
export async function GET(req: NextRequest, { params }: Params) {
  const { id, clienteId } = await params;
  if (!(await canManagePlace(req, id, "pedidos"))) {
    return await respuestaSinAcceso();
  }

  const config = await configFidelidadDe(id);
  if (!config) {
    return NextResponse.json({ error: "Tarjeta no configurada." }, { status: 404 });
  }

  const detalle = await detalleCliente(id, clienteId, config);
  if (!detalle) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  /* El panel ve el teléfono completo —es su cliente— y además el enmascarado,
     que es lo que se puede enseñar en la vista previa de la tarjeta. */
  return NextResponse.json({
    ...detalle,
    cliente: {
      ...detalle.cliente,
      telefonoEnmascarado:
        enmascararTelefono(detalle.cliente.telefono) ?? detalle.cliente.telefono,
    },
    config,
  });
}

/** Borra la tarjeta y su historial (cascada). Solo el dueño o `ficha`. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, clienteId } = await params;
  if (!(await canManagePlace(req, id, "ficha"))) {
    return await respuestaSinAcceso();
  }

  const borrado = await borrarCliente(id, clienteId);
  if (!borrado) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
