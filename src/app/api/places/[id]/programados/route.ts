import { NextRequest, NextResponse } from "next/server";
import { canManagePlace } from "@/lib/admin-server";
import { puede } from "@/lib/plans-server";
import { actualizarProgramados } from "@/lib/cocina-server";
import { esEntregaConfig, PROGRAMADOS_DEFAULT } from "@/lib/ficha/entrega";
import type { ProgramadosConfig } from "@/lib/ficha/entrega";

type Params = { params: Promise<{ id: string }> };

/**
 * Guarda la config de pedidos programados en `entrega.programados`.
 *
 * Solo el propietario con permiso `ficha` y el plan `pedidos_programados`.
 * Body: `ProgramadosConfig | null` (null = borrar la config).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!(await puede(id, "pedidos_programados"))) {
    return NextResponse.json(
      { error: "Los pedidos programados no están en tu plan." },
      { status: 403 },
    );
  }
  if (!(await canManagePlace(req, id, "ficha"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  if (body === null) {
    await actualizarProgramados(id, null);
    return NextResponse.json({ ok: true });
  }

  /* Validar campo a campo para dar un error específico. */
  const b = (body ?? {}) as Partial<ProgramadosConfig>;
  if (typeof b.activo !== "boolean") {
    return NextResponse.json({ error: "activo debe ser booleano." }, { status: 400 });
  }
  if (typeof b.diasMax !== "number" || b.diasMax < 1 || b.diasMax > 7) {
    return NextResponse.json({ error: "diasMax debe ser 1–7." }, { status: 400 });
  }
  if (typeof b.antelacionMin !== "number" || b.antelacionMin < 0) {
    return NextResponse.json({ error: "antelacionMin inválido." }, { status: 400 });
  }
  if (b.franjaMin !== 30 && b.franjaMin !== 60) {
    return NextResponse.json({ error: "franjaMin debe ser 30 ó 60." }, { status: 400 });
  }
  if (b.cupoPorFranja !== null && b.cupoPorFranja !== undefined) {
    if (typeof b.cupoPorFranja !== "number" || b.cupoPorFranja < 1) {
      return NextResponse.json({ error: "cupoPorFranja debe ser ≥ 1 o null." }, { status: 400 });
    }
  }
  if (typeof b.avisoMin !== "number" || b.avisoMin < 0) {
    return NextResponse.json({ error: "avisoMin inválido." }, { status: 400 });
  }

  const config: ProgramadosConfig = {
    activo: b.activo,
    diasMax: b.diasMax,
    antelacionMin: b.antelacionMin,
    franjaMin: b.franjaMin,
    cupoPorFranja: b.cupoPorFranja ?? null,
    avisoMin: b.avisoMin,
  };

  await actualizarProgramados(id, config);
  return NextResponse.json({ ok: true });
}

/** Devuelve la config actual o el default. Para que el editor la cargue. */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!(await canManagePlace(req, id, "ficha"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { db } = await import("@/lib/db");
  const { places } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await db
    .select({ entrega: places.entrega })
    .from(places)
    .where(eq(places.id, id))
    .limit(1);

  const entrega = (row?.entrega as { programados?: ProgramadosConfig } | null) ?? null;
  return NextResponse.json(entrega?.programados ?? PROGRAMADOS_DEFAULT);
}
