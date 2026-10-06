import type { SQL } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Ejecuta SQL crudo y devuelve **solo las filas**.
 *
 * En esta versión de `drizzle-orm/neon-http` el resultado es un objeto con
 * `.rows`, no un array plano —lo dice su propio `.d.ts`—, pero la nota de este
 * proyecto avisaba de lo contrario porque el `sql.query()` de Neon sí devuelve
 * un array. Se aceptan las dos formas: así una subida de driver no obliga a
 * revisar cada consulta del dashboard.
 */
export async function rows<T extends Record<string, unknown>>(
  query: SQL,
): Promise<T[]> {
  const result = await db.execute<T>(query);
  const wrapped = result as unknown as { rows?: T[] };
  return wrapped.rows ?? (result as unknown as T[]);
}
