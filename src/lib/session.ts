/**
 * El vocabulario del control de acceso: qué roles hay, qué rutas están cerradas
 * y cómo se construye una vuelta segura después de entrar.
 *
 * Ojo con el nombre del archivo: aquí ya **no hay ninguna sesión**. Este módulo
 * firmaba y verificaba una cookie con HMAC-SHA256 y llevaba el rol dentro. Desde
 * que la autenticación es Neon Managed Auth, las sesiones viven allí y el rol
 * vive en la tabla `users`. Lo que queda es lo único que no depende de quién
 * emita la sesión.
 *
 * Se borraron con `src/lib/accounts.ts`: `Session`, `SESSION_COOKIE`,
 * `SESSION_MAX_AGE`, `getSecret`, `signSession`, `readSession`, `cookieOptions`
 * e `isRole`. Si alguien busca `SESSION_COOKIE` y no lo encuentra, es esto.
 */

export type Role = "user" | "owner" | "admin";

/**
 * Rutas que exigen haber entrado.
 *
 * Antes cada regla traía su lista de roles y las aplicaba el middleware. Ahora
 * aquí solo se dice **qué está cerrado**. El rol se comprueba en el layout de
 * cada sección (`admin/layout.tsx`, `(main)/business/layout.tsx`), que es donde
 * ya se consulta la base de datos de todos modos; hacerlo aquí costaría una
 * consulta a Neon en cada petición, incluidas las de estáticos.
 *
 * `/admin` y `/business` aparecen igualmente porque el proxy corta antes de
 * renderizar nada: si el layout tuviera que hacerlo solo, la página empezaría a
 * construirse antes de saber que no toca.
 *
 * `/onboarding` no tiene layout propio, así que aquí es su única puerta.
 */
export const PROTECTED_PREFIXES = ["/admin", "/business", "/profile", "/onboarding"] as const;

/** Compara por prefijo **de segmento**: `/adminx` no entra por `/admin`. */
export function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Cabecera por la que el proxy le pasa la identidad al render.
 *
 * Hace falta porque la sesión no se puede preguntar dentro del render. El
 * paquete de Neon, cuando falla su caché de sesión, aplica el `Set-Cookie` que
 * devuelve el servidor con `cookies().set()`, y Next solo deja escribir cookies
 * en una Server Action, una ruta de API o el proxy: en el render eso lanza
 * `ReadonlyRequestCookiesError` (E1180) y se cae la página entera. Al proxy sí
 * le está permitido, así que la sesión se resuelve allí y viaja en esta
 * cabecera.
 *
 * El proxy la borra siempre antes de poner la suya: si no, cualquiera podría
 * mandarla desde el cliente y hacerse pasar por otro.
 */
export const AUTH_USER_HEADER = "x-lv-auth-user";

/**
 * Rutas cuyo render pregunta por el usuario de la app (`getAppUser`), y por
 * tanto las únicas en las que el proxy tiene que resolver la sesión.
 *
 * **Si una página nueva llama a `getAppUser`, su ruta entra aquí.** Sin la
 * cabecera el render cae al respaldo de `getAppUser` —pensado para las rutas de
 * API, que no pasan por el proxy— y ahí sí revienta con E1180.
 */
export function needsAppUser(pathname: string): boolean {
  return pathname === "/login" || isProtected(pathname);
}

/**
 * Destino de una redirección tras el login. Solo se aceptan rutas del propio
 * sitio: sin esto, `/login?next=https://otro-sitio` serviría para sacar a
 * alguien de La Verde justo después de escribir su contraseña.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  // `//otro.com` es una URL absoluta para el navegador aunque empiece por `/`.
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  return value;
}
