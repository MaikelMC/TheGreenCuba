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
 * `sessionDataTtl` vale por defecto **300 segundos**, y con ese valor la caché
 * de sesión se quedaba fría cada cinco minutos: a partir de ahí cada navegación
 * a una ruta privada obligaba al proxy a preguntarle a Neon en vivo —sin
 * timeout— y una llamada que fallase se leía como «no hay sesión» y mandaba a
 * `/login`. En una red como la de este proyecto eso es un cierre de sesión
 * aleatorio cada pocos minutos.
 *
 * Se iguala a la vida de la sesión en Neon (7 días, es lo que dura la fila en
 * `neon_auth.session`): la cookie firmada cubre la sesión entera y el proxy la
 * valida en memoria, sin salir a la red. El precio es que una sesión revocada
 * desde otro sitio sigue dando por buena la copia local hasta que expire; el
 * cierre de sesión de la app borra las dos cookies, así que ese caso es el
 * único que queda abierto.
 *
 * El resto del servidor no debería importar este módulo para preguntar por el
 * usuario: para eso está `getAppUser()` en `src/lib/auth/user.ts`, que además
 * traduce a la fila de la tabla `users` del proyecto. Este archivo conoce a
 * Neon; aquel conoce a la app.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    sessionDataTtl: 60 * 60 * 24 * 7,
  },
});
