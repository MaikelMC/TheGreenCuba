import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/server";

/**
 * Todas las rutas de autenticación, servidas por Better Auth.
 *
 * Esta única línea reemplaza a las cuatro rutas que había —`login`, `logout`,
 * `register` y `session`—, que firmaban y borraban nuestra propia cookie. El
 * manejador trae el juego entero: entrar, salir, alta, sesión, recuperar
 * contraseña, verificación por código y OAuth.
 *
 * No queda ni una ruta de auth escrita a mano, y es a propósito: cada una que se
 * escribiera aquí sería una forma de saltarse las que trae el SDK.
 *
 * Ojo con añadir rutas bajo `/api/auth/`. Una ruta estática gana a este
 * catch-all, así que `/api/auth/algo/route.ts` se serviría en vez de esto y no
 * daría ningún error: simplemente dejaría de funcionar la de Better Auth que se
 * llamara igual. Lo de la app va fuera de este prefijo; `/api/me` es el ejemplo.
 */
export const { GET, POST, PUT, PATCH, DELETE } = toNextJsHandler(auth);
