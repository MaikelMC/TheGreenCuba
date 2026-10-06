/**
 * Serialización CSV de la exportación (`§35`).
 *
 * Dos decisiones que se ven en el código:
 *
 * - **Se entrecomilla todo**, incluso un número. Así una coma o un salto de
 *   línea dentro de una consulta de búsqueda no rompe las columnas.
 * - **BOM de UTF-8 al principio.** Sin él, Excel en Windows abre el archivo en
 *   latin-1 y los acentos cubanos salen rotos.
 *
 * Es puro y sin dependencias: se prueba sin tocar la base
 * (`src/lib/analytics/csv.test.ts`).
 */

export const BOM = "\uFEFF";

/** Celda CSV: se entrecomilla siempre y se doblan las comillas internas. */
export function cell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

/** Cabeceras + filas, con BOM y terminador CRLF (el que espera Excel). */
export function csv(headers: string[], data: unknown[][]): string {
  const lines = [headers.map(cell).join(",")];
  for (const row of data) lines.push(row.map(cell).join(","));
  return BOM + lines.join("\r\n") + "\r\n";
}
