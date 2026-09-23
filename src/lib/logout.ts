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
 *
 * Se sale a la portada y no a `/login`: quien cierra sesión no tiene por qué
 * querer volver a entrar, y `/login` le pide la contraseña otra vez.
 */

/** Prefijos del navegador que pertenecen a la sesión que se está cerrando. */
const POR_PREFIJO = [
  /* Preferencias: la clave de cada usuario y la del cajón de invitado. */
  "la-verde:user:",
  /* Actividad: qué abrió y qué guardó. */
  "la-verde:activity:",
];

/** Claves sueltas que no comparten prefijo con nada. */
const EXACTAS = [
  /* La clave anterior a que las preferencias fueran por usuario. */
  "la-verde:user",
  /* El índice de «quién guardó la última vez», que leen el header y el mapa. */
  "la-verde:last-user",
  /* El historial del buscador: es lo más personal que guarda el navegador y
     faltaba aquí, así que sobrevivía al cierre de sesión. */
  "la-verde:recent-searches",
];

export async function logout(): Promise<void> {
  try {
    /* El cliente de Neon entra con `import()` y no con un `import` de arriba, y
       no es un detalle de estilo: `@neondatabase/auth` es **el trozo más grande
       de la aplicación** —unos 105 KB comprimidos, Better Auth entero— y este
       módulo lo importaba de forma estática. Como medio sitio importa `logout`
       para un botón, esos 105 KB viajaban en el paquete inicial de todas las
       páginas con header: el mapa, el panel de negocio y el de administración.
       Separado así, solo lo descarga quien cierra sesión.

       El formulario de entrar (`auth-card`) sí lo importa de forma estática, y
       ahí está bien: en `/login` el cliente *es* la pantalla. */
    const { authClient } = await import("@/lib/auth/client");
    await authClient.signOut();
  } finally {
    /* En `finally` a propósito: si el `import()` o el `signOut` fallan por red,
       hay que salir igual o el usuario se queda mirando un botón muerto. */
    try {
      for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
        const key = window.localStorage.key(i);
        if (
          key &&
          (POR_PREFIJO.some((prefix) => key.startsWith(prefix)) || EXACTAS.includes(key))
        ) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // El navegador puede bloquear localStorage en modo privado o sin permisos.
    }
    window.location.assign("/");
  }
}
