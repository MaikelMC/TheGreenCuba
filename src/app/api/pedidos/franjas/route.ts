import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pedidos, places } from "@/lib/db/schema";
import { tieneFuncion } from "@/lib/plans-server";
import { franjasDisponibles } from "@/lib/ficha/programados";
import type { EntregaConfig, ProgramadosConfig } from "@/lib/ficha/entrega";
import type { Horario } from "@/lib/ficha/horario";

/**
 * Franjas disponibles para pedidos programados.
 *
 * Público (como el carrito): lo llama el carrito del cliente antes de que el
 * usuario elija franja. No requiere sesión porque la carta es pública.
 * Rateado por `rateLimit` del módulo de pedidos.
 *
 * GET /api/pedidos/franjas?negocioId=<id>
 *
 * Respuesta: `{ dias: DiaDisponible[] }`
 * Cada `FranjaDisponible` lleva `inicio`/`fin` como ISO string para viajar por JSON.
 */
export async function GET(req: NextRequest) {
  const negocioId = (req.nextUrl.searchParams.get("negocioId") ?? "")
    .trim()
    .slice(0, 64);
  if (!negocioId) {
    return NextResponse.json({ error: "Falta el negocio." }, { status: 400 });
  }

  if (!(await tieneFuncion(negocioId, "pedidos_programados"))) {
    return NextResponse.json({ dias: [] });
  }

  const [row] = await db
    .select({ entrega: places.entrega, horario: places.horario })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);

  if (!row) return NextResponse.json({ dias: [] });

  const entrega = (row.entrega as EntregaConfig | null) ?? null;
  const pgConfig = entrega?.programados;
  if (!pgConfig?.activo) return NextResponse.json({ dias: [] });

  /* El horario de cocina manda; si no hay, el del local. */
  const horario =
    (entrega?.horario as Horario | null) ??
    (row.horario as Horario | null);

  /* Ocupación actual: pedidos nuevos agrupados por franja. */
  const ahora = new Date();
  const ocupRows = await db
    .select({
      franja: pedidos.programadoPara,
      cnt: sql<number>`cast(count(*) as int)`,
    })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.placeId, negocioId),
        eq(pedidos.estado, "nuevo"),
        isNotNull(pedidos.programadoPara),
        gte(pedidos.programadoPara, ahora),
      ),
    )
    .groupBy(pedidos.programadoPara);

  const ocupacion = new Map<string, number>(
    ocupRows
      .filter((r) => r.franja !== null)
      .map((r) => [new Date(r.franja!).toISOString(), r.cnt]),
  );

  const dias = franjasDisponibles(pgConfig, horario, ahora, ocupacion);

  /* Serializar Dates → ISO strings para JSON. */
  const diasJson = dias.map((d) => ({
    ...d,
    franjas: d.franjas.map((f) => ({
      ...f,
      inicio: f.inicio.toISOString(),
      fin: f.fin.toISOString(),
    })),
  }));

  return NextResponse.json({ dias: diasJson });
}
