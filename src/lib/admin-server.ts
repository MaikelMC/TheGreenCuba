import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Clave de administración. Falla en seco si no está configurada (sin fallback). */
export function getAdminKey(): string | null {
  const key = process.env.ADMIN_KEY;
  return key && key.trim().length > 0 ? key.trim() : null;
}

export function isValidAdminKey(key: string): boolean {
  const expected = getAdminKey();
  if (!expected || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isAdminRequest(req: NextRequest): boolean {
  const key = req.headers.get("x-admin-key") ?? "";
  return isValidAdminKey(key);
}
