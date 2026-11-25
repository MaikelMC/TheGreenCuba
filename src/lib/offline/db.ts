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

import { registrarFalloAlmacen } from "@/lib/diagnostico/telemetria";

export const DB_NAME = "la-verde-offline";
export const DB_VERSION = 3;

let dbPromise: Promise<IDBDatabase> | null = null;

/** Errores que se arreglan cerrando y reabriendo una vez. */
export function esErrorReintentable(error: unknown): boolean {
  if (!error) return false;
  const nombre =
    typeof error === "object" && error && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  const mensaje = error instanceof Error ? error.message : String(error);
  return (
    nombre === "InvalidStateError" ||
    nombre === "VersionError" ||
    nombre === "AbortError" ||
    /database connection is closing|transaction.*(closed|finished)|base cerrada|transaction on 'IDBDatabase'/i.test(
      mensaje,
    )
  );
}

/** ¿Es un fallo de cuota? Se resuelve borrando snapshots antiguos. */
export function esErrorCuota(error: unknown): boolean {
  if (!error) return false;
  const nombre =
    typeof error === "object" && error && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  return nombre === "QuotaExceededError" || /quota/i.test(String(error));
}

export function abrirDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  const promesa = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible"));
      return;
    }

    let asentado = false;
    let esperaBloqueo: ReturnType<typeof setTimeout> | null = null;

    const fallar = (error: Error) => {
      if (asentado) return;
      asentado = true;
      if (esperaBloqueo) clearTimeout(esperaBloqueo);
      reject(error);
    };

    let peticion: IDBOpenDBRequest;
    try {
      peticion = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      fallar(error instanceof Error ? error : new Error(String(error)));
      return;
    }

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
        const negociosStore = db.createObjectStore("negocios", { keyPath: "id" });
        negociosStore.createIndex("provincia", "provincia", { unique: false });
        negociosStore.createIndex("slug", "slug", { unique: false });
        db.createObjectStore("cartas", { keyPath: "id" });
        db.createObjectStore("sync", { keyPath: "provincia" });
      }
    };

    peticion.onsuccess = () => {
      if (asentado) {
        peticion.result.close();
        return;
      }
      asentado = true;
      if (esperaBloqueo) clearTimeout(esperaBloqueo);
      const db = peticion.result;

      /* Otra pestaña quiere actualizar: se cierra para no bloquearla. */
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };

      resolve(db);
    };

    peticion.onerror = () => {
      const error = peticion.error ?? new Error("No se pudo abrir IndexedDB");
      registrarFalloAlmacen(error.name || "Error", "abrir_db");
      fallar(error);
    };

    /* No se espera indefinidamente: si otra pestaña retiene la versión, se
       libera la promesa y la siguiente operación vuelve a intentarlo. */
    peticion.onblocked = () => {
      registrarFalloAlmacen("BlockedError", "abrir_db");
      esperaBloqueo = setTimeout(() => {
        fallar(new Error("IndexedDB bloqueada por otra pestaña"));
      }, 2500);
    };
  });

  dbPromise = promesa;
  /* Si falla, la siguiente operación puede abrir una conexión nueva. Se compara
     la identidad para no borrar una promesa más reciente. */
  promesa.catch(() => {
    if (dbPromise === promesa) dbPromise = null;
  });
  return promesa;
}

/**
 * Ejecuta una operación con un reintento si la conexión estaba cerrada.
 * El fallo final se registra sin mensaje completo y devuelve el respaldo.
 */
export async function conReintentoDb<T>(
  operacion: (db: IDBDatabase) => Promise<T>,
  respaldo: T,
  nombreOperacion: string,
): Promise<T> {
  for (let intento = 0; intento < 2; intento += 1) {
    try {
      const db = await abrirDb();
      return await operacion(db);
    } catch (error) {
      const reintentable = esErrorReintentable(error);
      if (intento === 0 && reintentable) {
        cerrarDb();
        continue;
      }
      if (!reintentable) {
        const nombre =
          typeof error === "object" && error && "name" in error
            ? String((error as { name?: unknown }).name)
            : "Error";
        registrarFalloAlmacen(nombre, nombreOperacion);
      }
      return respaldo;
    }
  }
  return respaldo;
}

/** Cierra y limpia el singleton (necesario antes de `deleteDatabase`). */
export function cerrarDb(): void {
  if (dbPromise) {
    dbPromise.then((db) => db.close()).catch(() => {});
    dbPromise = null;
  }
}
