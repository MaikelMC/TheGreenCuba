import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { isAdminRequest } from "@/lib/admin-server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { adminBroadcasts, notifications, users } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";

/**
 * Envío masivo de notificaciones a todos los usuarios, a nombre de
 * "Support La Verde".
 *
 * Una fila de `notifications` por usuario y una de `admin_broadcasts` como
 * historial del envío. La inserción es en bloque (`values` con el array
 * entero): un viaje a la base, no uno por usuario.
 *
 * El texto del remitente vive aquí y en la vista del usuario a la vez; si un
 * día cambia, es una constante y no una búsqueda por el código.
 */
export const BROADCAST_SENDER = "Support La Verde";

const MAX_TITLE = 120;
const MAX_MESSAGE = 2000;

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(adminBroadcasts)
    .orderBy(desc(adminBroadcasts.createdAt))
    .limit(50);

  return NextResponse.json({ broadcasts: rows });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    message?: unknown;
  } | null;

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!title || title.length > MAX_TITLE) {
    return NextResponse.json(
      { error: `El título es obligatorio (máximo ${MAX_TITLE} caracteres).` },
      { status: 400 },
    );
  }
  if (!message || message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `El mensaje es obligatorio (máximo ${MAX_MESSAGE} caracteres).` },
      { status: 400 },
    );
  }

  const sender = await getAppUser();

  /* Destinatarios: todos los perfiles con cuenta de acceso viva detrás — el
     mismo criterio de la lista de Usuarios del panel. Un perfil huérfano (sin
     fila en `neon_auth.user`) no puede entrar a la app a leerla. */
  const recipients = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.authUserId} IN (SELECT id::text FROM neon_auth.user)`);

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No hay usuarios para notificar." }, { status: 409 });
  }

  const broadcastId = generateId();

  await db.insert(notifications).values(
    recipients.map((recipient) => ({
      id: generateId(),
      userId: recipient.id,
      type: "broadcast",
      title,
      message,
      senderName: BROADCAST_SENDER,
    })),
  );

  await db.insert(adminBroadcasts).values({
    id: broadcastId,
    senderId: sender?.id ?? null,
    senderName: sender?.name ?? "Administración",
    title,
    message,
    recipientCount: recipients.length,
  });

  return NextResponse.json({ id: broadcastId, recipients: recipients.length }, { status: 201 });
}
