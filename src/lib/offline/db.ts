/**
 * Conexión compartida a IndexedDB `la-verde-offline`.
 *
 * Único punto de apertura: evita que `store.ts`, `cola.ts` y `negocios.ts`
 * abran el mismo DB con versiones distintas, lo que bloquearía la conexión.
 *
 * Historial de versiones:
 *  v1 → stores: snapshots, meta
 *  v2 → store: cola
 *  v3 → stores: negocios, cartas, sync  (fase 2 PWA)
 */

export const DB_NAME = "la-verde-offline";
export const DB_VERSION = 3;

let dbPromise: Promise<IDBDatabase> | null = null;

export function abrirDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible"));
      return;
    }

    const peticion = indexedDB.open(DB_NAME, DB_VERSION);

    peticion.onupgradeneeded = (event) => {
      const db = peticion.result;
      const oldVersion = event.oldVersion;

      /* ── v1 ───────────────────────────────────────────────────────── */
      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }

      /* ── v2 ───────────────────────────────────────────────────────── */
      if (!db.objectStoreNames.contains("cola")) {
        db.createObjectStore("cola", { keyPath: "id" });
      }

      /* ── v3 ───────────────────────────────────────────────────────── */
      if (oldVersion < 3) {
        /* negocios: datos ligeros de cada negocio público.
           Índice por provincia para leer todos los de una provincia de golpe.
           Índice por slug para resolver /m/[slug] desde lo local. */
        const negociosStore = db.createObjectStore("negocios", { keyPath: "id" });
        negociosStore.createIndex("provincia", "provincia", { unique: false });
        negociosStore.createIndex("slug", "slug", { unique: false });

        /* cartas: menu + carta completa guardada al abrir la ficha. */
        db.createObjectStore("cartas", { keyPath: "id" });

        /* sync: estado de sincronización por provincia. */
        db.createObjectStore("sync", { keyPath: "provincia" });
      }
    };

    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => {
      dbPromise = null;
      reject(peticion.error ?? new Error("No se pudo abrir IndexedDB"));
    };
    /* Si otra pestaña tiene la base abierta en v2, el upgrade se bloquea.
       No esperamos indefinidamente: tras 10 s resolvemos con la conexión
       existente si ya llegó, o rechazamos. El caller lo captura con try/catch. */
    peticion.onblocked = () => {
      /* No hacer nada: `onsuccess` llegará cuando la otra pestaña cierre. */
    };
  });

  return dbPromise;
}

/** Cierra y limpia el singleton (necesario antes de `deleteDatabase`). */
export function cerrarDb(): void {
  if (dbPromise) {
    dbPromise.then((db) => db.close()).catch(() => {});
    dbPromise = null;
  }
}
