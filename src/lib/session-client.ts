/**
 * La sesión de la app, pedida una sola vez por pestaña.
 *
 * `/api/me` resuelve la sesión contra Neon y hace hasta cuatro consultas —el
 * usuario, su negocio, sus proyectos y el consentimiento—, y lo llamaban doce
 * sitios distintos. En `/home` coinciden tres —el header, el menú de usuario y
 * la propia página—, así que una carga eran tres invocaciones de función con el
 * mismo cuerpo. En `/perfil` pasa lo mismo con otras tres.
 *
 * Aquí la promesa se guarda en el módulo: la primera llamada sale a la red y
 * las demás esperan a esa misma. El resultado se queda cacheado, así que
 * navegar de `/home` a `/perfil` tampoco vuelve a pedirlo.
 *
 * **Quien escriba con `POST` o `DELETE` sobre `/api/me` tiene que llamar a
 * `refreshSession()`.** Si no, la pestaña sigue sirviendo la sesión anterior al
 * guardado: se cambia el nombre en el perfil y el menú lo enseña viejo hasta
 * recargar. Es el mismo fallo silencioso que ya costó caro con la cookie de
 * desarrollo, y por eso la caché no vive dentro de un componente.
 */

import { borrarDatosOffline, leerAuth, marcarAuth } from "@/lib/offline/store";

let cached: Promise<unknown> | null = null;

/**
 * La petición cacheada salió de un `force`.
 *
 * Sin esta marca, los dos reintentos que caen en el mismo turno —el del header
 * y el del menú— se pisarían el uno al otro y serían dos peticiones en lugar de
 * una, que es justo lo que esto viene a quitar.
 */
let cachedForced = false;

async function pedir(): Promise<unknown> {
  const response = await fetch("/api/me");
  if (!response.ok) throw new Error(`/api/me respondió ${response.status}`);
  const data = (await response.json()) as {
    authenticated?: boolean;
    user?: { id?: string } | null;
  };

  /* Cada respuesta correcta con usuario es una confirmación de que la sesión
     sigue viva. Se anota para que el modo offline sepa cuándo caduca: pasados
     siete días sin una confirmación, los snapshots privados se bloquean. */
  if (data.authenticated && data.user?.id) {
    const userId = data.user.id;
    try {
      /* Si el teléfono cambió de cuenta, los snapshots de la anterior se
         borran **antes** de que el nuevo escriba los suyos. Sin esto, el
         segundo usuario abriría el panel offline y vería el negocio del
         primero. */
      const previa = await leerAuth();
      if (previa && previa.userId !== userId) {
        await borrarDatosOffline();
      }
    } catch {
      // Un fallo del almacén local no puede impedir leer la sesión.
    }
    await marcarAuth(userId, Date.now());
  }

  return data;
}

/**
 * El usuario de la app.
 *
 * **Lanza** si falla la red o el JSON, igual que hacía
 * `fetch("/api/me").then((res) => res.json())`: los `.catch()` que ya había en
 * cada llamante siguen valiendo tal cual. El tipo se pasa por parámetro porque
 * cada sitio lee una parte distinta de la respuesta —unos el id, otros el
 * negocio, otros las preferencias— y no hay uno solo que los cubra a todos.
 *
 * `force` vuelve a preguntar aunque haya respuesta cacheada. Lo usan los dos
 * reintentos del header y del menú, que existen porque `/api/me` contesta
 * `authenticated: false` tanto si no hay sesión como si se cayó el viaje a
 * Neon. Sin `force` el reintento leería la misma respuesta cacheada y no
 * reintentaría nada.
 */
export function fetchMe<T>(options: { force?: boolean } = {}): Promise<T> {
  if (!cached || (options.force && !cachedForced)) {
    cachedForced = Boolean(options.force);
    cached = pedir().then(
      (value) => {
        cachedForced = false;
        return value;
      },
      (error: unknown) => {
        /* Un fallo no se cachea: la siguiente llamada vuelve a intentarlo. */
        cached = null;
        cachedForced = false;
        throw error;
      },
    );
  }
  return cached as Promise<T>;
}

/** Tira la sesión cacheada. Obligatorio tras cualquier `POST` o `DELETE`. */
export function refreshSession(): void {
  cached = null;
  cachedForced = false;
}
