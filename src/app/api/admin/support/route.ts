import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { db } from "@/lib/db";
import { supportTickets } from "@/lib/db/schema";
import { sendEmail, adminNoticeHtml } from "@/lib/email";

/**
 * Panel de administración de tickets de soporte.
 *
 * `GET` lista con filtros por estado y texto. `PATCH` actualiza el estado y
 * opcionalmente guarda una respuesta que **se envía por correo al usuario**
 * con el remitente y plantilla de La Verde. El envío es best-effort: si
 * Resend falla, la respuesta queda guardada igual y el panel lo indica.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() ?? "";
  const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

  const rows = await db
    .select()
    .from(supportTickets)
    .orderBy(desc(supportTickets.createdAt))
    .limit(200);

  /* Los filtros van en memoria y no en SQL a propósito: son 200 filas como
     mucho, y filtrar el texto en JS permite buscar en asunto, mensaje,
     snapshot y respuesta sin un ILIKE por columna. */
  const filtered = rows
    .filter((row) => (status ? row.status === status : true))
    .filter((row) =>
      query
        ? `${row.subject} ${row.message} ${row.userSnapshot?.name ?? ""} ${row.userSnapshot?.email ?? ""} ${row.adminReply ?? ""}`
            .toLowerCase()
            .includes(query)
        : true,
    );

  return NextResponse.json({ tickets: filtered });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    status?: unknown;
    reply?: unknown;
  } | null;

  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Ticket inválido" }, { status: 400 });

  const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
  if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

  const STATUS = ["open", "in_progress", "resolved", "closed"] as const;
  const status =
    typeof body?.status === "string" && (STATUS as readonly string[]).includes(body.status)
      ? (body.status as (typeof STATUS)[number])
      : undefined;

  const reply = typeof body?.reply === "string" ? body.reply.trim().slice(0, 3000) : undefined;
  if (!status && reply === undefined) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  /* Responder marca resuelto salvo que el admin diga otra cosa: es el gesto
     natural — escribiste la respuesta, el caso está atendido. */
  const nextStatus = status ?? (reply !== undefined ? "resolved" : undefined);

  const [updated] = await db
    .update(supportTickets)
    .set({
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(reply !== undefined ? { adminReply: reply, repliedAt: new Date() } : {}),
    })
    .where(eq(supportTickets.id, id))
    .returning();

  let emailSent = false;
  if (reply && updated) {
    /* Respuesta al usuario por correo con la plantilla de La Verde. Best-effort:
       si Resend falla, la respuesta ya está guardada y el panel lo indica. */
    const id = await sendEmail({
      to: [updated.email],
      subject: `Respuesta a tu ticket: ${updated.subject}`,
      html: adminNoticeHtml(
        "Respondimos tu ticket",
        [
          ["Asunto", updated.subject],
          ["Estado", updated.status === "resolved" ? "Resuelto" : updated.status],
        ],
        reply,
      ),
      text: reply,
    });
    emailSent = id !== null;
  }

  return NextResponse.json({ ticket: updated, emailSent });
}
