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
    window.location.assign("/login");
  }
}
