import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import {
  readWaitlist,
  writeWaitlist,
  type WaitlistStatus,
} from "@/lib/waitlist-store";

const VALID_STATUSES: WaitlistStatus[] = ["nuevo", "contactado", "agregado"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = (await req.json()) as { status?: WaitlistStatus };
    const entries = readWaitlist();
    const existing = entries.find((e) => e.id === id);
    if (!existing) {
      return NextResponse.json(
        { error: "Solicitud no encontrada" },
        { status: 404 },
      );
    }
    const status: WaitlistStatus = VALID_STATUSES.includes(
      body.status as WaitlistStatus,
    )
      ? (body.status as WaitlistStatus)
      : existing.status;
    writeWaitlist(
      entries.map((e) => (e.id === id ? { ...e, status } : e)),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const entries = readWaitlist();
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) {
    return NextResponse.json(
      { error: "Solicitud no encontrada" },
      { status: 404 },
    );
  }
  writeWaitlist(next);
  return NextResponse.json({ ok: true });
}
