import type { SQL } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Ejecuta SQL crudo y devuelve **solo las filas**: con `node-postgres`,
 * `db.execute` devuelve un `QueryResult` y las filas van en `.rows`.
 */
export async function rows<T extends Record<string, unknown>>(
  query: SQL,
): Promise<T[]> {
  return (await db.execute<T>(query)).rows as T[];
}
