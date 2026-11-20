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
 *
 * **Si el servidor no da la sesión por cerrada, no se navega.** El proxy valida
 * la cookie en memoria durante siete días, así que irse a la portada con la
 * sesión viva es peor que quedarse: la persona cree que cerró y al volver sigue
 * dentro. Se limpia igual el navegador y se avisa para que reintente.
 */

import { toast } from "sonner";
import { purgarDatosPrivados } from "@/lib/offline/store";

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

/**
 * Si el error dice que ya no había sesión que cerrar.
 *
 * Neon responde 401 cuando la sesión no existe. Eso es un cierre igual de
 * bueno que el otro: pasa, por ejemplo, justo después de borrar la cuenta, que
 * se lleva por delante las filas de `neon_auth.session`.
 */
function sesionYaNoValia(error: unknown): boolean {
  const status = Number(
    (error as { status?: unknown })?.status ??
      (error as { statusCode?: unknown })?.statusCode,
  );
  return status === 401;
}

/**
 * Cierra la sesión contra Neon, con un reintento.
 *
 * `signOut` no lanza cuando el servidor responde con error: devuelve
 * `{ error }`. Cualquier fallo que no sea «ya no había sesión» se reintenta una
 * vez, que es lo que cubre un corte de un segundo en datos móviles.
 */
async function cerrarEnServidor(): Promise<boolean> {
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

  for (let intento = 0; intento < 2; intento += 1) {
    try {
      const result = await authClient.signOut();
      if (!result?.error) return true;
      if (sesionYaNoValia(result.error)) return true;
    } catch (error) {
      if (sesionYaNoValia(error)) return true;
    }
  }

  return false;
}

export async function logout(): Promise<void> {
  /* Primero el servidor. Si no se pudo, el resto de este cierre no puede
     fingir que sí: el aviso de abajo es la única salida honesta. */
  const cerrada = await cerrarEnServidor();

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

  /* Snapshot de negocio, de perfil y cachés de imágenes. Va aquí, y no solo
     cuando el cierre salió bien, por el mismo motivo de siempre: los datos del
     usuario anterior no pueden quedarse en el teléfono. En un dispositivo
     compartido eso es una fuga, no una molestia. */
  try {
    await purgarDatosPrivados();
  } catch {
    // IndexedDB o Cache Storage bloqueados: no hay nada más que hacer.
  }

  if (!cerrada) {
    /* Sin navegación a propósito: ver la cabecera del archivo. El toast deja el
       botón a mano para reintentar en cuanto vuelva la conexión. */
    toast.error(
      "No pudimos cerrar la sesión en el servidor. Comprueba tu conexión y vuelve a intentarlo.",
      { duration: 9000 },
    );
    return;
  }

  window.location.assign("/");
}
