/**
 * Estado del almacenamiento local de La Verde.
 *
 * `navigator.storage.persist()` evita que el navegador borre las cachés y
 * IndexedDB bajo presión de memoria. En Android con poca RAM —la mayoría de
 * los teléfonos cubanos— la evicción es habitual y deja la app sin modo
 * offline sin avisar. Pedir persistencia no es una promesa —el navegador la
 * concede o no—, pero sin pedirla nunca se obtiene.
 *
 * Se guarda el resultado en el store `meta` de IndexedDB para no volver a
 * pedirlo: si ya es persistente, una nueva llamada no cambia nada pero sí
 * cuesta una ida al SO.
 */

const META_KEY = "storage-persisted";

/** Si el almacenamiento ya es persistente según el navegador. */
async function esPersistente(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}

/** Pide persistencia si no la tiene. Devuelve si se obtuvo. */
async function pedirPersistencia(): Promise<boolean> {
  try {
    if (await esPersistente()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/**
 * Pide persistencia si aún no se tiene, y devuelve el estado del
 * almacenamiento. Llámala en los momentos relevantes (app instalada, primer
 * pedido, panel del dueño): es idempotente y no hace nada si ya es
 * persistente.
 */
export async function asegurarPersistencia(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  return pedirPersistencia();
}

/** Uso y cuota del almacenamiento local, en bytes. */
export interface EstadoAlmacenamiento {
  persisted: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
}

/** Para la fase 5 (panel de ajustes). */
export async function estadoAlmacenamiento(): Promise<EstadoAlmacenamiento> {
  const persisted = await esPersistente();
  try {
    const estimate = await navigator.storage?.estimate?.();
    return {
      persisted,
      usageBytes: estimate?.usage ?? null,
      quotaBytes: estimate?.quota ?? null,
    };
  } catch {
    return { persisted, usageBytes: null, quotaBytes: null };
  }
}
