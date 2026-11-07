/**
 * Cola de envíos pendientes para el modo offline.
 *
 * Cuando el navegador no tiene red, las acciones que necesitan el servidor
 * —pedidos, reservas— se guardan aquí y se reenvían al volver la conexión.
 * Solo se encolan acciones que el usuario ya confirmó: el mensaje de WhatsApp
 * ya salió, esto es solo el registro en la base de datos.
 *
 * El store `cola` vive en la misma base `la-verde-offline` que los snapshots,
 * para no abrir dos conexiones. La versión sube a 2 para que `onupgradeneeded`
 * cree el nuevo store sin borrar los existentes.
 */

const DB_NAME = "la-verde-offline";
const DB_VERSION = 2;
const STORE_COLA = "cola";

export type TipoAccion = "pedido" | "reserva";

export interface AccionPendiente {
  id: string;
  tipo: TipoAccion;
  ruta: string;
  metodo: string;
  cuerpo: string;
  creadoEn: number;
  intentos: number;
}

/** Espera mínima entre reintentos, en ms. Se duplica con cada fallo (máx 5 min). */
const ESPERA_BASE_MS = 30_000;
const ESPERA_MAX_MS = 5 * 60_000;

function esperaMs(intentos: number): number {
  return Math.min(ESPERA_BASE_MS * 2 ** intentos, ESPERA_MAX_MS);
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
      /* Los stores de v1 (snapshots, meta) se conservan. Solo se añade `cola`. */
      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_COLA)) {
        db.createObjectStore(STORE_COLA, { keyPath: "id" });
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

/** Añade una acción a la cola. Devuelve si se pudo escribir. */
export async function encolar(accion: Omit<AccionPendiente, "creadoEn" | "intentos">): Promise<boolean> {
  try {
    const db = await abrirDb();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_COLA, "readwrite");
      tx.objectStore(STORE_COLA).put({
        ...accion,
        creadoEn: Date.now(),
        intentos: 0,
      } satisfies AccionPendiente);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Lista de acciones pendientes, ordenadas por fecha de creación. */
export async function pendientes(): Promise<AccionPendiente[]> {
  try {
    const db = await abrirDb();
    return await new Promise<AccionPendiente[]>((resolve) => {
      const tx = db.transaction(STORE_COLA, "readonly");
      const peticion = tx.objectStore(STORE_COLA).getAll() as IDBRequest<AccionPendiente[]>;
      peticion.onsuccess = () =>
        resolve(
          (peticion.result ?? []).sort((a, b) => a.creadoEn - b.creadoEn),
        );
      peticion.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function borrarAccion(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_COLA, "readwrite");
    tx.objectStore(STORE_COLA).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function actualizarIntentos(db: IDBDatabase, accion: AccionPendiente): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_COLA, "readwrite");
    tx.objectStore(STORE_COLA).put({ ...accion, intentos: accion.intentos + 1 });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/**
 * Reenvía las acciones pendientes.
 *
 * - Éxito (2xx): borra la acción.
 * - Error de cliente (4xx): descarta la acción (no tiene sentido reintentar).
 * - Error de red o 5xx: incrementa intentos y deja para después.
 *
 * Devuelve cuántas acciones se enviaron con éxito.
 */
export async function procesarCola(): Promise<number> {
  let enviados = 0;
  let db: IDBDatabase;

  try {
    db = await abrirDb();
  } catch {
    return 0;
  }

  const cola = await pendientes();
  if (cola.length === 0) return 0;

  for (const accion of cola) {
    /* Espera creciente: si ya se intentó y falló hace poco, no reintentar. */
    if (accion.intentos > 0) {
      const tiempoDesde = Date.now() - accion.creadoEn;
      if (tiempoDesde < esperaMs(accion.intentos - 1)) continue;
    }

    try {
      const res = await fetch(accion.ruta, {
        method: accion.metodo,
        headers: { "Content-Type": "application/json" },
        body: accion.cuerpo,
      });

      if (res.ok) {
        await borrarAccion(db, accion.id);
        enviados++;
      } else if (res.status >= 400 && res.status < 500) {
        /* Error de cliente: sin cupo, negocio eliminado… No tiene sentido
           reintentar. El usuario ya envió WhatsApp, el dueño lo confirma por ahí. */
        console.warn(
          `[cola] descartada acción ${accion.id} (${accion.tipo}): servidor respondió ${res.status}`,
        );
        await borrarAccion(db, accion.id);
      } else {
        await actualizarIntentos(db, accion);
      }
    } catch {
      /* Error de red: dejar para después. */
      await actualizarIntentos(db, accion);
    }
  }

  return enviados;
}
