/**
 * Los lugares guardados, ahora en el servidor.
 *
 * Antes el corazón del home escribía solo en `localStorage` y `saved_places`
 * era una tabla que se leía pero que nadie llenaba: el perfil podía enseñar una
 * lista y el mapa otra. Estas funciones son el puente. El `localStorage` sigue
 * siendo la copia de invitado y la red de seguridad sin conexión.
 *
 * La migración de los guardados locales se hace **una vez por cuenta** y solo
 * sube los que faltan; no borra la copia local. Si la subida falla, se reintenta
 * en la siguiente carga en vez de dar por perdido lo que había.
 */

const MIGRATED_KEY = "la-verde:lugares-migrados:";

function marcaDeMigracion(userId: string): string {
  return `${MIGRATED_KEY}${userId}`;
}

async function leerGuardados(): Promise<string[] | null> {
  try {
    const res = await fetch("/api/me/places");
    if (!res.ok) return null;
    const data = (await res.json()) as {
      authenticated?: boolean;
      saved?: { placeId?: unknown }[];
    };
    if (!data.authenticated || !Array.isArray(data.saved)) return null;
    return data.saved
      .map((fila) => fila.placeId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return null;
  }
}

/** Sube varios de una vez. Devuelve si el servidor los aceptó. */
export async function guardarLugares(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    const res = await fetch("/api/me/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeIds: ids }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function guardarLugar(placeId: string): Promise<boolean> {
  return guardarLugares([placeId]);
}

export async function quitarLugar(placeId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/me/places", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Lo que hay que pintar al entrar: la lista del servidor más lo local que
 * todavía no se había subido.
 *
 * Si el servidor no contesta se devuelve la copia local tal cual: sin conexión
 * el mapa no puede quedarse sin corazones.
 */
export async function sincronizarGuardados(
  userId: string,
  locales: string[],
): Promise<string[]> {
  const servidor = await leerGuardados();
  if (servidor === null) return locales;

  let migrado = false;
  try {
    migrado = window.localStorage.getItem(marcaDeMigracion(userId)) === "1";
  } catch {
    // Sin almacenamiento se intenta igual; la marca no es imprescindible.
  }

  if (migrado) return servidor;

  const pendientes = locales.filter((id) => !servidor.includes(id));
  if (pendientes.length === 0) {
    marcarMigrado(userId);
    return servidor;
  }

  if (!(await guardarLugares(pendientes))) {
    /* Se enseñan igual, pero sin marcar: la próxima carga lo reintenta. */
    return [...servidor, ...pendientes];
  }

  marcarMigrado(userId);
  return [...servidor, ...pendientes];
}

function marcarMigrado(userId: string): void {
  try {
    window.localStorage.setItem(marcaDeMigracion(userId), "1");
  } catch {
    // Nada que hacer: se volverá a intentar sin efectos, es idempotente.
  }
}
