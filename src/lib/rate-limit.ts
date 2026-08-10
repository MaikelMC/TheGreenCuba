import type { NextRequest } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
const MAX_ENTRIES = 5000;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Limita por IP en memoria (por instancia). Ventana deslizante simple por token bucket. */
export function rateLimit(req: NextRequest, limit: number, windowMs: number): {
  ok: boolean;
  retryAfterSeconds?: number;
} {
  const key = `${clientIp(req)}:${windowMs}`;
  const now = Date.now();

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    prune(now);
    return { ok: true };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true };
}

function prune(now: number): void {
  if (store.size <= MAX_ENTRIES) return;
  for (const [k, v] of store) {
    if (store.size <= MAX_ENTRIES / 2) break;
    if (v.resetAt <= now) store.delete(k);
  }
}
