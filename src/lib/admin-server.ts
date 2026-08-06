import type { NextRequest } from "next/server";

export function getAdminKey(): string {
  return process.env.ADMIN_KEY || "la-verde-admin-2026";
}

export function isValidAdminKey(key: string): boolean {
  return key.length > 0 && key === getAdminKey();
}

export function isAdminRequest(req: NextRequest): boolean {
  const key = req.headers.get("x-admin-key") ?? "";
  return isValidAdminKey(key);
}
