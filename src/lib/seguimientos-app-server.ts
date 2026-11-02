import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { seguimientos } from "@/lib/db/schema";
import { generateId } from "@/lib/utils";

/**
 * Los «Avísame» de la app, del lado del servidor.
 *
 * Es la versión con sesión de lo que `seguidores` hace con Telegram: una fila
 * dice que esta persona quiere enterarse de las novedades de este negocio. La
 * diferencia está en la identidad —aquí hay `user_id`, allí un chat— y por eso
 * son dos tablas y no una columna más.
 *
 * Todo es **idempotente**: seguir dos veces no duplica y dejar de seguir dos
 * veces no falla. El diálogo de la ficha puede reenviar el mismo gesto tras un
 * corte de red sin dejar rastro de más.
 */

export async function seguirNegocio(
  usuarioId: string,
  negocioId: string,
): Promise<void> {
  await db
    .insert(seguimientos)
    .values({ id: generateId(), usuarioId, negocioId })
    .onConflictDoNothing({
      target: [seguimientos.usuarioId, seguimientos.negocioId],
    });
}

export async function dejarDeSeguir(
  usuarioId: string,
  negocioId: string,
): Promise<void> {
  await db
    .delete(seguimientos)
    .where(
      and(
        eq(seguimientos.usuarioId, usuarioId),
        eq(seguimientos.negocioId, negocioId),
      ),
    );
}

/** ¿Este usuario sigue a este negocio? Lo que pinta el interruptor de la ficha. */
export async function sigueNegocio(
  usuarioId: string,
  negocioId: string,
): Promise<boolean> {
  const [fila] = await db
    .select({ id: seguimientos.id })
    .from(seguimientos)
    .where(
      and(
        eq(seguimientos.usuarioId, usuarioId),
        eq(seguimientos.negocioId, negocioId),
      ),
    )
    .limit(1);
  return Boolean(fila);
}

/**
 * Los usuarios que siguen a un negocio desde la app.
 *
 * Sin filtrar por dispositivo ni por permiso: quien sigue es quien sigue, y el
 * envío decide después cuáles tienen una suscripción push viva. Separar las dos
 * cosas es lo que permite que un usuario que activa los avisos más tarde reciba
 * los siguientes sin tener que volver a marcar el negocio.
 */
export async function seguidoresDeNegocio(
  negocioId: string,
): Promise<string[]> {
  const filas = await db
    .select({ usuarioId: seguimientos.usuarioId })
    .from(seguimientos)
    .where(eq(seguimientos.negocioId, negocioId));
  return filas.map((fila) => fila.usuarioId);
}
