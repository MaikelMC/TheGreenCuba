import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";

/**
 * Consentimiento de novedades, del lado del servidor.
 *
 * Todo lo que escribe `public.contacts` pasa por aquí. Las tres operaciones son
 * un upsert y dos lecturas; no hay una cuarta porque nadie más pregunta por
 * esta tabla.
 */

/**
 * Deja constancia de que esta persona existe, sin novedades.
 *
 * Se llama al crear la fila de `users`, o sea en el primer acceso de cualquiera
 * —también de quien entra con Google, que es el caso que esto viene a cubrir—.
 * `false` no es «se dio de baja»: es «no ha decidido». Se distingue de la baja
 * por `opted_in_at`, que aquí queda a `null`.
 *
 * `onConflictDoNothing`: si ya hay fila —una relectura, una carrera— no se pisa
 * la decisión que esa persona ya tomó.
 */
export async function ensureContact(userId: string, email: string): Promise<void> {
  await db
    .insert(contacts)
    .values({ userId, email })
    .onConflictDoNothing({ target: contacts.userId });
}

/**
 * Guarda la decisión de esta persona sobre las novedades.
 *
 * `optedInAt` se sella con la hora del **servidor** cuando dice que sí, y vuelve
 * a `null` cuando dice que no: la columna es la fecha de la decisión vigente, no
 * un histórico. La hora del cliente no vale como constancia de consentimiento.
 */
export async function setMarketingOptIn(
  userId: string,
  email: string,
  optIn: boolean,
): Promise<void> {
  const optedInAt = optIn ? new Date() : null;
  await db
    .insert(contacts)
    .values({ userId, email, marketingOptIn: optIn, optedInAt })
    .onConflictDoUpdate({
      target: contacts.userId,
      set: { email, marketingOptIn: optIn, optedInAt },
    });
}

export async function isMarketingOptedIn(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ optIn: contacts.marketingOptIn })
    .from(contacts)
    .where(eq(contacts.userId, userId))
    .limit(1);
  return row?.optIn ?? false;
}

/**
 * Si la cuenta tiene el proveedor de Google detrás.
 *
 * Se pregunta a `neon_auth.account` —el esquema de Neon, solo lectura— porque es
 * el único sitio donde consta. Es lo que distingue a quien se registró con
 * Google: esa cuenta no tiene contraseña, y por eso el formulario de
 * correo+contraseña le falla sin explicar nada. La consulta no es de la app, así
 * que no pasa por el esquema de Drizzle.
 */
export async function isGoogleAccount(authUserId: string): Promise<boolean> {
  const result = await db.execute<{ ok: number }>(sql`
    SELECT 1 AS ok
    FROM neon_auth."account"
    WHERE "userId" = ${authUserId}::uuid AND "providerId" = 'google'
    LIMIT 1
  `);
  return (result.rows ?? []).length > 0;
}
