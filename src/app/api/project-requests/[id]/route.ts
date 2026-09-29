import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { notifications, projectRequests } from "@/lib/db/schema";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAppUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { status?: unknown; adminNote?: unknown } | null;
  const status = body?.status;
  if (status !== "approved" && status !== "rejected" && status !== "pending") {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  const [updated] = await db.update(projectRequests).set({
    status,
    adminNote: typeof body?.adminNote === "string" ? body.adminNote.trim().slice(0, 1000) : undefined,
    updatedAt: new Date(),
  }).where(eq(projectRequests.id, id)).returning();
  if (!updated) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId: updated.userId,
    type: status === "approved" ? "project_approved" : status === "rejected" ? "project_rejected" : "project_updated",
    title: status === "approved" ? "Proyecto aprobado" : status === "rejected" ? "Proyecto no aprobado" : "Proyecto actualizado",
    message: status === "rejected"
      ? updated.adminNote
        ? `Tu proyecto «${updated.name}» no fue aprobado. Motivo: ${updated.adminNote}`
        : `Tu proyecto «${updated.name}» fue revisado y no aprobado. Puedes corregir los datos y enviarlo nuevamente.`
      : `Tu proyecto «${updated.name}» fue marcado como ${status === "approved" ? "aprobado" : "pendiente"}.`,
  });
  return NextResponse.json(updated);
}