import { NextRequest, NextResponse } from "next/server";
import { canManagePlace, respuestaSinAcceso } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { tieneFuncion } from "@/lib/plans-server";
import {
  configFidelidadDe,
  crearCliente,
  estadisticasFidelidad,
  listarClientes,
  negocioPublico,
} from "@/lib/fidelidad-server";
import { normalizarTelefono } from "@/lib/telefono";

type Params = { params: Promise<{ id: string }> };

/**
 * Las tarjetas del negocio.
 *
 * `GET` es la lista con búsqueda por teléfono o nombre, por actividad reciente.
 * El teléfono completo solo viaja al equipo del negocio: esta ruta pasa por
 * `canManagePlace` con permiso `pedidos`, y la tarjeta pública nunca enseña más
 * que el número enmascarado.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!(await canManagePlace(req, id, "pedidos"))) {
    return await respuestaSinAcceso();
  }

  const config = await configFidelidadDe(id);
  if (!config) {
    return NextResponse.json({
      clientes: [],
      config: null,
      tieneModulo: await tieneFuncion(id, "cliente_frecuente"),
    });
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const [clientes, negocio, stats] = await Promise.all([
    listarClientes(id, q.slice(0, 60), config),
    negocioPublico(id),
    estadisticasFidelidad(id),
  ]);

  return NextResponse.json({
    clientes,
    config,
    negocio,
    stats,
    tieneModulo: await tieneFuncion(id, "cliente_frecuente"),
  });
}

/**
 * Da de alta una tarjeta con los sellos que el cliente ya tenía en papel.
 *
 * `pedidos`, no `ficha`: es el mismo mostrador que da sellos a mano. La nota
 * es obligatoria cuando hay sellos iniciales, porque son los que explican el
 * saldo seis meses después.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!(await canManagePlace(req, id, "pedidos"))) {
    return await respuestaSinAcceso();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const telefono = typeof b.telefono === "string" ? b.telefono : "";
  const nombre = typeof b.nombre === "string" ? b.nombre : null;
  const nota = typeof b.nota === "string" ? b.nota : "";
  const sellos =
    typeof b.sellos === "number" ? b.sellos : Number(b.sellos ?? 0);

  if (!normalizarTelefono(telefono)) {
    return NextResponse.json(
      { error: "Ese teléfono no es un número cubano de 8 dígitos." },
      { status: 400 },
    );
  }

  const usuario = await getAppUser();
  const resultado = await crearCliente(
    id,
    telefono,
    nombre,
    sellos,
    nota,
    usuario?.id ?? null,
  );

  switch (resultado.estado) {
    case "creado":
      return NextResponse.json({ ok: true, cliente: resultado.cliente });
    case "duplicado":
      return NextResponse.json(
        { error: "Ese teléfono ya tiene tarjeta en este negocio." },
        { status: 409 },
      );
    case "sin_funcion":
      return NextResponse.json(
        { error: "La tarjeta de cliente frecuente no está en tu plan." },
        { status: 403 },
      );
    case "telefono_invalido":
      return NextResponse.json({ error: "Teléfono inválido." }, { status: 400 });
    default:
      return NextResponse.json(
        { error: "Revisa los sellos iniciales y la nota." },
        { status: 400 },
      );
  }
}
