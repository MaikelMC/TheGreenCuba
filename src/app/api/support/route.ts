import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { supportTickets } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";
import { notifyAdmins } from "@/lib/email";

/**
 * Tickets de soporte desde la app.
 *
 * `POST` crea el ticket. Va con sesión obligatoria: el que reporta tiene una
 * cuenta, y el correo del remitente es lo que necesita el que atiende para
 * responder. El anónimo ya tiene camino: el `mailto:` de Configuración.
 *
 * El aviso a administración es best-effort: si el correo falla, el ticket ya
 * está guardado y aparece en el panel de Soporte. Nada del flujo depende de
 * que el correo salga.
 */
export async function POST(req: NextRequest) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    subject?: unknown;
    message?: unknown;
    pagePath?: unknown;
  } | null;

  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const pagePath = typeof body?.pagePath === "string" ? body.pagePath.trim().slice(0, 200) : null;

  if (subject.length < 3 || subject.length > 150) {
    return NextResponse.json(
      { error: "El asunto debe tener entre 3 y 150 caracteres." },
      { status: 400 },
    );
  }
  if (message.length < 10 || message.length > 3000) {
    return NextResponse.json(
      { error: "Describe el problema con al menos 10 caracteres (máximo 3000)." },
      { status: 400 },
    );
  }

  const ticketId = generateId();

  await db.insert(supportTickets).values({
    id: ticketId,
    userId: user.id,
    email: user.email,
    userSnapshot: { name: user.name ?? null, email: user.email },
    subject,
    message,
    pagePath,
  });

  await notifyAdmins({
    subject: `[Soporte La Verde] ${subject}`,
    heading: "Nuevo ticket de soporte",
    body: "Un usuario reportó un problema desde la app. Ábrelo en el panel: Admin → Soporte.",
    rows: [
      ["Usuario", user.name ?? "—"],
      ["Correo", user.email],
      ["Asunto", subject],
      ["Pantalla", pagePath ?? "—"],
    ],
  });

  return NextResponse.json({ id: ticketId }, { status: 201 });
}

/** Los tickets del propio usuario, para que vea lo que ya reportó. */
export async function GET() {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      message: supportTickets.message,
      status: supportTickets.status,
      adminReply: supportTickets.adminReply,
      repliedAt: supportTickets.repliedAt,
      createdAt: supportTickets.createdAt,
    })
    .from(supportTickets)
    .where(eq(supportTickets.userId, user.id))
    .orderBy(desc(supportTickets.createdAt))
    .limit(50);

  return NextResponse.json({ tickets: rows });
}
