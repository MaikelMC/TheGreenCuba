import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getAppUser } from "@/lib/auth/user";

/** Clave de administración. Falla en seco si no está configurada (sin fallback). */
export function getAdminKey(): string | null {
  const key = process.env.ADMIN_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

export function isValidAdminKey(key: string): boolean {
  const expected = getAdminKey();
  if (!expected || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Quién puede llamar a las rutas de API de administración. Dos caminos, y solo
 * dos:
 *
 * 1. **La sesión.** Es el camino normal desde que `/admin` entra por `/login`:
 *    el navegador manda la cookie, Neon la valida y aquí se mira el rol, que
 *    vive en la tabla `users`.
 * 2. **La cabecera `x-admin-key`.** Se conserva para `curl`, los scripts y los
 *    servicios que ya la usaban. Retirarla rompería a quien no pasa por el
 *    navegador, y no aporta ninguna seguridad a cambio.
 *
 * Sigue siendo `async`, pero ya no por la firma —de eso se encarga Neon— sino
 * porque comprobar el rol es una consulta a la base.
 *
 * Ojo con el orden: la cabecera se comprueba primero y sin tocar la base. Es el
 * camino de los scripts, y no tiene por qué pagar una consulta.
 */
export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  if (isValidAdminKey(req.headers.get("x-admin-key") ?? "")) return true;

  const user = await getAppUser();
  return user?.role === "admin";
}
