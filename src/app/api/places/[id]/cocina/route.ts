import { NextRequest, NextResponse } from "next/server";
import { canManagePlace } from "@/lib/admin-server";
import { puede } from "@/lib/plans-server";
import { actualizarPausa, actualizarHorarioCocina } from "@/lib/cocina-server";
import { esHorario } from "@/lib/ficha/horario";

type Params = { params: Promise<{ id: string }> };

/**
 * Abre/cierra la cocina con una pausa manual (`pausa`) o guarda el horario
 * recurrente (`horario`). Solo uno de los dos campos por llamada.
 *
 * `pausa`   → permiso `pedidos`. Body: `{ pausa: {...} | null }`
 * `horario` → permiso `ficha`.   Body: `{ horario: Horario | null }`
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!(await puede(id, "horario_cocina"))) {
    return NextResponse.json(
      { error: "El horario de cocina no está incluido en tu plan." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;

  /* ── Horario recurrente ─────────────────────────────────────────────── */
  if ("horario" in b) {
    if (!(await canManagePlace(req, id, "ficha"))) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const horario = b.horario;
    if (horario !== null && !esHorario(horario)) {
      return NextResponse.json({ error: "Horario inválido." }, { status: 400 });
    }

    await actualizarHorarioCocina(id, horario ?? null);
    return NextResponse.json({ ok: true });
  }

  /* ── Pausa manual ───────────────────────────────────────────────────── */
  if (!(await canManagePlace(req, id, "pedidos"))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pausa = b.pausa;

  /* `null` = quitar pausa. Objeto = poner pausa. */
  if (pausa !== null && pausa !== undefined) {
    if (typeof pausa !== "object" || Array.isArray(pausa)) {
      return NextResponse.json({ error: "Pausa inválida." }, { status: 400 });
    }
    const p = pausa as Record<string, unknown>;
    if (typeof p.desde !== "number" || !Number.isFinite(p.desde)) {
      return NextResponse.json({ error: "Pausa inválida: falta `desde`." }, { status: 400 });
    }
    if (p.hasta !== null && (typeof p.hasta !== "number" || !Number.isFinite(p.hasta))) {
      return NextResponse.json({ error: "Pausa inválida: `hasta` debe ser número o null." }, { status: 400 });
    }

    await actualizarPausa(id, {
      desde: p.desde as number,
      hasta: (p.hasta as number | null) ?? null,
      motivo: typeof p.motivo === "string" ? p.motivo.trim().slice(0, 100) : undefined,
    });
  } else {
    await actualizarPausa(id, undefined);
  }

  return NextResponse.json({ ok: true });
}
