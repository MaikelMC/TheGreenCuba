import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * El programa de afiliados, del lado del servidor.
 *
 * Un afiliado es un usuario con `referral_code`, y su enlace es
 * `/register?ref=<código>`. Quien se registre entrando por ahí queda apuntado en
 * `referred_by`.
 *
 * El parámetro de la consulta no llega hasta el alta: por medio hay una
 * verificación por código, un salto a Google y vuelta, y una recarga entera del
 * documento en los tres caminos. Por eso el código se copia a una cookie en
 * cuanto aparece —lo hace el proxy, que es el único sitio que puede escribir
 * cookies antes del render— y la cookie es lo que se lee al crear la fila.
 */

export const REFERRAL_PARAM = "ref";

export const REFERRAL_COOKIE = "lv-ref";

/**
 * Treinta días, que es la ventana con la que se mide cualquier programa de
 * referidos: el enlace se manda hoy y quien lo recibe se registra cuando le
 * apetece, no en el acto.
 *
 * `lax` y no `strict`: la vuelta de Google es una navegación `GET` de nivel
 * superior desde otro dominio, y con `strict` la cookie no viajaría y el alta
 * con Google perdería la atribución. `httpOnly` porque nadie la lee desde el
 * navegador. `secure` solo en producción, o en local —que es `http`— el
 * navegador la descartaría.
 */
export const REFERRAL_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  secure: process.env.NODE_ENV === "production",
} as const;

/**
 * El `users.id` del afiliado dueño de este código, o `null`.
 *
 * Se resuelve **al crear la fila** y no al escribir la cookie a propósito: si el
 * administrador retira a un afiliado entre el clic y el alta, el código deja de
 * existir y la atribución no ocurre, que es lo correcto. Resolviéndolo antes, la
 * cookie llevaría ya un id y el retiro no serviría de nada.
 *
 * Un código que no está —retirado, inventado, mal copiado— devuelve `null` sin
 * ruido: el alta sigue, solo que sin padrino.
 */
export async function referrerIdFor(code: string): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referralCode, code))
    .limit(1);

  return row?.id ?? null;
}
