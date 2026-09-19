import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * Neon Managed Auth, del lado del servidor.
 *
 * Sustituye a `src/lib/accounts.ts`, que era una lista de tres correos escrita a
 * mano con la contraseña leída de `.env`. Las cuentas, las sesiones y las
 * contraseñas viven ahora en Neon, en su propio esquema `neon_auth`; aquí no se
 * guarda ni se compara ninguna credencial.
 *
 * Las dos variables se leen sin valor por defecto a propósito. Un `?? ""` haría
 * que la app arrancara con la autenticación averiada y fallara más tarde, al
 * primer inicio de sesión, con un error que no señala al sitio. Sin ellas
 * revienta al construir la configuración, que es donde se arregla.
 *
 * `NEON_AUTH_COOKIE_SECRET` firma la cookie de sesión con HMAC-SHA256 y Neon
 * pide 32 caracteres o más. Se genera con:
 *   openssl rand -base64 32
 *
 * El resto del servidor no debería importar este módulo para preguntar por el
 * usuario: para eso está `getAppUser()` en `src/lib/auth/user.ts`, que además
 * traduce a la fila de la tabla `users` del proyecto. Este archivo conoce a
 * Neon; aquel conoce a la app.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});
