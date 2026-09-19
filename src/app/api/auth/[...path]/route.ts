import { auth } from "@/lib/auth/server";

/**
 * Todas las rutas de autenticación, servidas por Neon.
 *
 * Esta única línea reemplaza a las cuatro rutas que había —`login`, `logout`,
 * `register` y `session`—, que firmaban y borraban nuestra propia cookie. El
 * manejador de Neon trae el juego entero de Better Auth: entrar, salir, alta,
 * sesión, recuperar contraseña, verificación de correo y OAuth.
 *
 * No queda ni una ruta de auth escrita a mano, y es a propósito: cada una que se
 * escribiera aquí sería una forma de saltarse las que trae el SDK.
 *
 * Ojo con añadir rutas bajo `/api/auth/`. Una ruta estática gana a este
 * catch-all, así que `/api/auth/algo/route.ts` se serviría en vez de esto y no
 * daría ningún error: simplemente dejaría de funcionar la de Neon que se
 * llamara igual. Lo de la app va fuera de este prefijo; `/api/me` es el ejemplo.
 *
 * Se exportan los cinco métodos que trae el manejador —lo dice su tipo, no la
 * documentación, que solo enseña `GET` y `POST`—. Better Auth resuelve casi todo
 * por POST, pero `PUT`, `PATCH` y `DELETE` existen para operaciones concretas, y
 * dejar los tres fuera haría que esas llamadas devolvieran un 405 sin relación
 * aparente con la autenticación.
 */
export const { GET, POST, PUT, PATCH, DELETE } = auth.handler();
