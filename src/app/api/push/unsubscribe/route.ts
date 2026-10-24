import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/user";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";

/**
 * Baja de un dispositivo concreto.
 *
 * El `endpoint` viaja en el cuerpo y no en la URL: es una cadena larga con
 * caracteres que no sobreviven a un path sin tropezar con el enrutador, y no
 * queremos que acabe en los logs de acceso como identificador de dispositivo.
 *
 * El `and` con `userId` no es decorativo: sin él, conocer el endpoint de otro
 * bastaría para dejarle sin avisos.
 */
export async function DELETE(request: NextRequest) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json({ error: "Falta el endpoint." }, { status: 400 });
  }

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, user.id),
        eq(pushSubscriptions.endpoint, endpoint),
      ),
    );

  return NextResponse.json({ ok: true });
}
