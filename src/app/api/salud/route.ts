import { NextResponse } from "next/server";

/**
 * Comprobación de vida del contenedor. No toca la base de datos ni requiere sesión.
 * El proxy excluye todas las rutas /api/* del matcher, así que llega sin filtros.
 */
export function GET() {
  return NextResponse.json({ ok: true });
}
