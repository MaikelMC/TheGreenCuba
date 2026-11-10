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

import { abrirDb } from "./db";
import { setSinRed } from "./estado-red";

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
  /** Estado del ciclo de vida. `rejected` es terminal: fallo 4xx irreversible. */
  status: "pending" | "sending" | "rejected";
  /** Mensaje de error cuando `status === "rejected"`. */
  error?: string;
}

/** Espera mínima entre reintentos, en ms. Se duplica con cada fallo (máx 5 min). */
const ESPERA_BASE_MS = 30_000;
const ESPERA_MAX_MS = 5 * 60_000;

function esperaMs(intentos: number): number {
  return Math.min(ESPERA_BASE_MS * 2 ** intentos, ESPERA_MAX_MS);
}

/** Añade una acción a la cola. Devuelve si se pudo escribir. */
export async function encolar(
  accion: Omit<AccionPendiente, "creadoEn" | "intentos" | "status" | "error">,
): Promise<boolean> {
  try {
    const db = await abrirDb();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_COLA, "readwrite");
      tx.objectStore(STORE_COLA).put({
        ...accion,
        creadoEn: Date.now(),
        intentos: 0,
        status: "pending",
      } satisfies AccionPendiente);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Lista de acciones que pueden enviarse (excluye las rechazadas permanentemente).
 * Ordenadas por fecha de creación.
 */
export async function pendientes(): Promise<AccionPendiente[]> {
  try {
    const db = await abrirDb();
    return await new Promise<AccionPendiente[]>((resolve) => {
      const tx = db.transaction(STORE_COLA, "readonly");
      const peticion = tx.objectStore(STORE_COLA).getAll() as IDBRequest<AccionPendiente[]>;
      peticion.onsuccess = () =>
        resolve(
          (peticion.result ?? [])
            .filter((a) => a.status !== "rejected")
            .sort((a, b) => a.creadoEn - b.creadoEn),
        );
      peticion.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function escribirAccion(db: IDBDatabase, accion: AccionPendiente): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_COLA, "readwrite");
    tx.objectStore(STORE_COLA).put(accion);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function borrarAccion(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_COLA, "readwrite");
    tx.objectStore(STORE_COLA).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** Al arrancar el flush, devuelve a `pending` los que quedaron en `sending`
 *  por una pestaña que murió en medio de un envío. */
async function revertirEnviando(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_COLA, "readwrite");
    const store = tx.objectStore(STORE_COLA);
    const req = store.getAll() as IDBRequest<AccionPendiente[]>;
    req.onsuccess = () => {
      for (const accion of req.result ?? []) {
        if (accion.status === "sending") {
          store.put({ ...accion, status: "pending" });
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export interface ResultadoFlush {
  enviados: number;
  rechazados: number;
}

/** Núcleo del flush. Se llama dentro del lock. */
async function _procesarCola(): Promise<ResultadoFlush> {
  let db: IDBDatabase;
  try {
    db = await abrirDb();
  } catch {
    return { enviados: 0, rechazados: 0 };
  }

  await revertirEnviando(db);

  const cola = await pendientes();
  if (cola.length === 0) return { enviados: 0, rechazados: 0 };

  let enviados = 0;
  let rechazados = 0;

  for (const accion of cola) {
    /* Backoff: si ya falló y no ha pasado el tiempo mínimo, omitir. */
    if (accion.intentos > 0) {
      const tiempoDesde = Date.now() - accion.creadoEn;
      if (tiempoDesde < esperaMs(accion.intentos - 1)) continue;
    }

    /* Marcar como `sending` antes del fetch: si la pestaña muere, al volver
       se revertirá a `pending` en el próximo flush. */
    await escribirAccion(db, { ...accion, status: "sending" });

    try {
      const res = await fetch(accion.ruta, {
        method: accion.metodo,
        headers: { "Content-Type": "application/json" },
        body: accion.cuerpo,
      });

      if (res.ok) {
        setSinRed(false);
        await borrarAccion(db, accion.id);
        enviados++;
      } else if (res.status >= 400 && res.status < 500) {
        /* Error de cliente: sin cupo, negocio eliminado… Terminal: no reintentar.
           Se conserva con `rejected` para que la UI pueda avisarlo al usuario. */
        const errorMsg = `${res.status} ${res.statusText}`.trim();
        await escribirAccion(db, { ...accion, status: "rejected", error: errorMsg });
        rechazados++;
      } else {
        /* 5xx: transitorio, volver a `pending`. */
        await escribirAccion(db, { ...accion, status: "pending", intentos: accion.intentos + 1 });
      }
    } catch {
      /* Error de red: transitorio. */
      setSinRed(true);
      await escribirAccion(db, { ...accion, status: "pending", intentos: accion.intentos + 1 });
    }
  }

  return { enviados, rechazados };
}

/**
 * Reenvía las acciones pendientes.
 *
 * - Éxito (2xx): borra la acción.
 * - Error de cliente (4xx): marca `rejected` (terminal, se muestra al usuario).
 * - Error de red o 5xx: vuelve a `pending` con backoff exponencial (máx 5 min).
 *
 * Exclusión mutua vía `navigator.locks` (una sola pestaña envía a la vez).
 * Fallback a flag en memoria si el navegador no tiene la API.
 */
// ponytail: flag de fallback, solo protege dentro de la misma pestaña; navigator.locks cubre las demás
let _flushEnCurso = false;

export async function procesarCola(): Promise<ResultadoFlush> {
  if (typeof navigator !== "undefined" && "locks" in navigator) {
    return navigator.locks.request(
      "lv-flush-cola",
      { ifAvailable: true },
      async (lock) => lock ? _procesarCola() : { enviados: 0, rechazados: 0 },
    );
  }
  if (_flushEnCurso) return { enviados: 0, rechazados: 0 };
  _flushEnCurso = true;
  try {
    return await _procesarCola();
  } finally {
    _flushEnCurso = false;
  }
}
