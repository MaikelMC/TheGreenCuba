/**
 * Almacén local del modo offline.
 *
 * IndexedDB y no Cache Storage: aquí no se guardan pares petición/respuesta, se
 * guardan **datos privados** con su fecha. Cache Storage es compartida por todo
 * el origen y el service worker la puede devolver a cualquiera; IndexedDB se
 * queda en el teléfono y se borra al cerrar sesión.
 *
 * Dos stores:
 *  - `snapshots`: un registro por clave (`business:{userId}:{placeId}`,
 *    `profile:{userId}`) con `{ key, data, savedAt }`.
 *  - `meta`: `auth` con `{ key: "auth", userId, lastAuthAt }`. Es lo que permite
 *    bloquear los datos privados cuando la sesión lleva más de 7 días sin
 *    verificarse.
 *
 * Todo es best-effort: si el navegador bloquea IndexedDB (modo privado de
 * Safari, permisos), la app sigue funcionando sin offline. Ninguna función
 * lanza por un fallo del almacén.
 */

const DB_NAME = "la-verde-offline";
const DB_VERSION = 1;
const STORE_SNAPSHOTS = "snapshots";
const STORE_META = "meta";

export interface OfflineSnapshot<T = unknown> {
  key: string;
  data: T;
  /** ISO 8601. Se usa en `offline.html` para pintar «actualizado …». */
  savedAt: string;
}

export interface AuthOffline {
  key: "auth";
  userId: string;
  /** Epoch ms de la última vez que el servidor confirmó la sesión. */
  lastAuthAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function abrirDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible"));
      return;
    }

    const peticion = indexedDB.open(DB_NAME, DB_VERSION);

    peticion.onupgradeneeded = () => {
      const db = peticion.result;
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };

    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => {
      dbPromise = null;
      reject(peticion.error ?? new Error("No se pudo abrir IndexedDB"));
    };
  });

  return dbPromise;
}

async function conStore<T>(
  store: string,
  modo: IDBTransactionMode,
  accion: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  try {
    const db = await abrirDb();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(store, modo);
      const peticion = accion(tx.objectStore(store));
      peticion.onsuccess = () => resolve(peticion.result ?? null);
      peticion.onerror = () => resolve(null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Clave de un negocio. Lleva el usuario dentro para que dos cuentas no se pisen. */
export function claveNegocio(userId: string, placeId: string): string {
  return `business:${userId}:${placeId}`;
}

/** Clave del perfil. */
export function clavePerfil(userId: string): string {
  return `profile:${userId}`;
}

/** Guarda (o reemplaza) un snapshot. Devuelve si se pudo escribir. */
export async function guardarSnapshot({
  key,
  data,
}: {
  key: string;
  data: unknown;
}): Promise<boolean> {
  try {
    const db = await abrirDb();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_SNAPSHOTS, "readwrite");
      tx.objectStore(STORE_SNAPSHOTS).put({
        key,
        data,
        savedAt: new Date().toISOString(),
      } satisfies OfflineSnapshot);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Lee un snapshot concreto, o `null`. */
export async function leerSnapshot<T = unknown>(key: string): Promise<OfflineSnapshot<T> | null> {
  const fila = await conStore<OfflineSnapshot<T>>(STORE_SNAPSHOTS, "readonly", (store) =>
    store.get(key) as IDBRequest<OfflineSnapshot<T>>,
  );
  return fila ?? null;
}

/**
 * Todos los snapshots de un usuario.
 *
 * Se filtran el perfil y **solo** los negocios de ese usuario: una clave con el
 * id de otra cuenta no puede aparecer aquí ni por error.
 */
export async function listarSnapshots(userId: string): Promise<OfflineSnapshot[]> {
  const filas = await conStore<OfflineSnapshot[]>(STORE_SNAPSHOTS, "readonly", (store) =>
    store.getAll() as IDBRequest<OfflineSnapshot[]>,
  );
  if (!filas) return [];

  return filas.filter(
    (fila) =>
      fila.key === clavePerfil(userId) || fila.key.startsWith(`business:${userId}:`),
  );
}

/** Anota que el servidor acaba de confirmar la sesión de este usuario. */
export async function marcarAuth(userId: string, timestamp: number): Promise<void> {
  await conStore(STORE_META, "readwrite", (store) =>
    store.put({ key: "auth", userId, lastAuthAt: timestamp } satisfies AuthOffline),
  );
}

/** La última sesión confirmada, o `null` si nunca la hubo. */
export async function leerAuth(): Promise<AuthOffline | null> {
  const fila = await conStore<AuthOffline>(STORE_META, "readonly", (store) =>
    store.get("auth") as IDBRequest<AuthOffline>,
  );
  return fila ?? null;
}

/**
 * Borra la base entera de offline.
 *
 * `deleteDatabase` se queda bloqueado si hay una conexión abierta, así que hay
 * que cerrarla antes. Se resuelve igual si el navegador no deja: la prioridad es
 * que el cierre de sesión no se detenga.
 */
export async function borrarDatosOffline(): Promise<void> {
  try {
    if (dbPromise) {
      const db = await dbPromise.catch(() => null);
      db?.close();
      dbPromise = null;
    }
  } catch {
    dbPromise = null;
  }

  if (typeof indexedDB === "undefined") return;

  await new Promise<void>((resolve) => {
    let terminado = false;
    const acabar = () => {
      if (terminado) return;
      terminado = true;
      resolve();
    };

    try {
      const peticion = indexedDB.deleteDatabase(DB_NAME);
      peticion.onsuccess = acabar;
      peticion.onerror = acabar;
      /* `onblocked` significa que otra pestaña tiene la base abierta; no se
         espera indefinidamente. */
      peticion.onblocked = acabar;
    } catch {
      acabar();
    }
  });
}

/**
 * Purga las cachés privadas y pide al service worker que haga lo mismo.
 *
 * Va aunque `authClient.signOut()` falle por red: en un teléfono compartido, los
 * datos del usuario anterior no pueden sobrevivir al botón de salir.
 */
export async function purgarCachesPrivadas(): Promise<void> {
  try {
    const nombres = await caches.keys();
    await Promise.all(
      nombres
        .filter((nombre) => nombre.startsWith("lv-private-") || nombre.startsWith("lv-images-"))
        .map((nombre) => caches.delete(nombre)),
    );
  } catch {
    // Sin `caches` (contexto no seguro) no hay nada que borrar.
  }

  try {
    if ("serviceWorker" in navigator) {
      const registro = await navigator.serviceWorker.ready;
      registro.active?.postMessage({ type: "PURGE_PRIVATE" });
    }
  } catch {
    // Sin service worker activo la caché se borra igual desde aquí.
  }
}

/** Borra todo lo privado: base local + cachés. */
export async function purgarDatosPrivados(): Promise<void> {
  await Promise.all([borrarDatosOffline(), purgarCachesPrivadas()]);
}
