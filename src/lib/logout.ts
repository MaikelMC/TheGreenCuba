import { authClient } from "@/lib/auth/client";

/**
 * Cierre de sesión, en un solo sitio.
 *
 * Cuatro pantallas lo ofrecen —el menú de usuario, el panel de negocio, el de
 * administración y los ajustes del perfil— y las cuatro tienen que hacer
 * exactamente lo mismo. Con la copia en cada una, olvidarse de una es cuestión
 * de tiempo.
 *
 * Antes esto era un `fetch` a `/api/auth/logout`, una ruta propia que borraba
 * nuestra cookie. Ya no hay ruta propia: la sesión la emite y la revoca Neon, y
 * quien la revoca desde el navegador es este cliente.
 *
 * `window.location.assign` y no `router.push`, y sigue valiendo igual: el
 * App Router guarda el árbol de la ruta en caché, así que una navegación por
 * cliente puede repintar la versión con sesión. Una carga limpia no.
 */
export async function logout(): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    try {
      const currentUserKeyPattern = "la-verde:user:";
      const activityUserKeyPattern = "la-verde:activity:";
      for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(currentUserKeyPattern) || key?.startsWith(activityUserKeyPattern)) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // El navegador puede bloquear localStorage en modo privado o sin permisos.
    }
    window.location.assign("/");
  }
}
