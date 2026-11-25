import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ACCION, registrarActividad } from "@/lib/admin-actividad";
import { isAdminRequest } from "@/lib/admin-server";
import { cargarSoporteAdmin } from "@/lib/admin-soporte";
import { db } from "@/lib/db";
import { supportTickets, users } from "@/lib/db/schema";
import { sendEmail, adminNoticeHtml } from "@/lib/email";

/**
 * Panel de administración de tickets de soporte.
 *
 * `GET` lista las conversaciones con el contexto real del negocio de cada
 * persona, los administradores disponibles y el tiempo medio de respuesta de
 * la semana. `PATCH` responde, cambia el estado o asigna la conversación. Toda
 * mutación deja una entrada en Actividad.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() ?? "";
  const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

  const datos = await cargarSoporteAdmin();
  const tickets = datos.tickets
    .filter((ticket) => (status ? ticket.status === status : true))
    .filter((ticket) =>
      query
        ? `${ticket.subject} ${ticket.message} ${ticket.userSnapshot?.name ?? ""} ${ticket.userSnapshot?.email ?? ""} ${ticket.email}`
            .toLowerCase()
            .includes(query)
        : true,
    );

  return NextResponse.json({ ...datos, tickets });
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    status?: unknown;
    reply?: unknown;
    assignedAdminId?: unknown;
  } | null;

  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Ticket inválido" }, { status: 400 });

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, id))
    .limit(1);
  if (!ticket) return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });

  const STATUS = ["open", "in_progress", "resolved", "closed"] as const;
  const status =
    typeof body?.status === "string" &&
    (STATUS as readonly string[]).includes(body.status)
      ? (body.status as (typeof STATUS)[number])
      : undefined;

  const reply =
    typeof body?.reply === "string" ? body.reply.trim().slice(0, 3000) : undefined;
  if (reply !== undefined && reply.length === 0) {
    return NextResponse.json(
      { error: "La respuesta no puede quedar vacía" },
      { status: 400 },
    );
  }

  const traeAsignacion =
    body !== null && Object.prototype.hasOwnProperty.call(body, "assignedAdminId");
  if (
    traeAsignacion &&
    body?.assignedAdminId !== null &&
    typeof body?.assignedAdminId !== "string"
  ) {
    return NextResponse.json({ error: "Asignación inválida" }, { status: 400 });
  }

  const asignadoId =
    typeof body?.assignedAdminId === "string"
      ? body.assignedAdminId.trim() || null
      : null;
  let asignado: { id: string; name: string | null; email: string } | null = null;
  if (traeAsignacion && asignadoId) {
    const [admin] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.id, asignadoId), eq(users.role, "admin")))
      .limit(1);
    if (!admin) {
      return NextResponse.json(
        { error: "La cuenta indicada no es administradora" },
        { status: 400 },
      );
    }
    asignado = admin;
  }

  if (!status && reply === undefined && !traeAsignacion) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  /* Responder marca resuelto salvo que el admin diga otra cosa: es el gesto
     natural — escribiste la respuesta, el caso está atendido. */
  const nextStatus = status ?? (reply !== undefined ? "resolved" : undefined);
  const cambios: Partial<typeof supportTickets.$inferInsert> = {};

  if (nextStatus) cambios.status = nextStatus;
  if (reply !== undefined) {
    cambios.adminReply = reply;
    cambios.repliedAt = new Date();
  }
  if (traeAsignacion) {
    cambios.assignedAdminId = asignado?.id ?? null;
    cambios.assignedAt = asignado ? new Date() : null;
  }

  const [updated] = await db
    .update(supportTickets)
    .set(cambios)
    .where(eq(supportTickets.id, id))
    .returning();

  let emailSent = false;
  if (reply && updated) {
    /* Respuesta al usuario por correo con la plantilla de La Verde. Best-effort:
       si el correo falla, la respuesta ya está guardada y el panel lo indica. */
    const emailId = await sendEmail({
      to: [updated.email],
      subject: `Respuesta a tu ticket: ${updated.subject}`,
      html: adminNoticeHtml(
        "Respondimos tu ticket",
        [
          ["Asunto", updated.subject],
          [
            "Estado",
            updated.status === "resolved" ? "Resuelto" : updated.status,
          ],
        ],
        reply,
      ),
      text: reply,
    });
    emailSent = emailId !== null;
  }

  if (traeAsignacion) {
    await registrarActividad({
      accion: ACCION.asignarConversacion,
      objetoTipo: "soporte",
      objetoId: id,
      resumen: asignado
        ? `Asignó la conversación «${ticket.subject}» a ${asignado.name?.trim() || asignado.email}`
        : `Dejó sin asignar la conversación «${ticket.subject}»`,
      datos: {
        asignadoAnterior: ticket.assignedAdminId,
        asignadoNuevo: asignado?.id ?? null,
      },
    });
  }

  if (reply !== undefined) {
    await registrarActividad({
      accion: ACCION.responderSoporte,
      objetoTipo: "soporte",
      objetoId: id,
      resumen: `Respondió el ticket «${ticket.subject}»`,
      datos: {
        estadoAnterior: ticket.status,
        estadoNuevo: nextStatus ?? ticket.status,
        correoEnviado: emailSent,
      },
    });
  } else if (status) {
    await registrarActividad({
      accion: ACCION.cambiarEstadoSoporte,
      objetoTipo: "soporte",
      objetoId: id,
      resumen: `Cambió el estado del ticket «${ticket.subject}» a ${nextStatus}`,
      datos: { estadoAnterior: ticket.status, estadoNuevo: nextStatus },
    });
  }

  return NextResponse.json({ ticket: updated, emailSent });
}
