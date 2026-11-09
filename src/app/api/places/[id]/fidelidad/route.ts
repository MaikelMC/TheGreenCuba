import { NextRequest, NextResponse } from "next/server";
import { canManagePlace, respuestaSinAcceso } from "@/lib/admin-server";
import { tieneFuncion } from "@/lib/plans-server";
import {
  configFidelidadDe,
  guardarConfigFidelidad,
} from "@/lib/fidelidad-server";

type Params = { params: Promise<{ id: string }> };

/**
 * La configuración de la tarjeta de sellos.
 *
 * Vive en su propia ruta y en su propia columna (`places.fidelidad`) para que
 * ningún otro guardado de la ficha pueda pisarla. `GET` la lee aunque el plan
 * se haya caído —los datos son del negocio— y avisa de qué funciones faltan
 * para que el panel enseñe el candado correcto.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!(await canManagePlace(req, id))) {
    return await respuestaSinAcceso();
  }

  const [config, tieneModulo, tienePedidos] = await Promise.all([
    configFidelidadDe(id),
    tieneFuncion(id, "cliente_frecuente"),
    tieneFuncion(id, "whatsapp_pedido"),
  ]);

  return NextResponse.json({
    config,
    tieneModulo,
    tienePedidos,
    activa: Boolean(config?.activo && tieneModulo && tienePedidos),
  });
}

/** Guarda la tarjeta. Configurarla es de `ficha`, como el resto de la ficha. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!(await canManagePlace(req, id, "ficha"))) {
    return await respuestaSinAcceso();
  }
  if (!(await tieneFuncion(id, "cliente_frecuente"))) {
    return NextResponse.json(
      { error: "La tarjeta de cliente frecuente no está en tu plan." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const resultado = await guardarConfigFidelidad(id, body);
  if (!resultado.success) {
    return NextResponse.json(
      { error: resultado.error },
      { status: resultado.code === "no_encontrado" ? 404 : 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
