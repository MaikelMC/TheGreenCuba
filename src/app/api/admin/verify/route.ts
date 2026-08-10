import { NextRequest, NextResponse } from "next/server";
import { isValidAdminKey } from "@/lib/admin-server";
import { rateLimit } from "@/lib/rate-limit";

const VERIFY_LIMIT = 10;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;

function tooMany(retryAfterSeconds?: number): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Demasiados intentos. Espera unos minutos." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds ?? 60) },
    },
  );
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, VERIFY_LIMIT, VERIFY_WINDOW_MS);
  if (!limited.ok) return tooMany(limited.retryAfterSeconds);

  try {
    const body = (await req.json()) as { key?: unknown };
    const key = typeof body?.key === "string" ? body.key.trim().slice(0, 200) : "";
    if (!key) {
      return NextResponse.json(
        { ok: false, error: "Clave requerida" },
        { status: 400 },
      );
    }
    if (isValidAdminKey(key)) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { ok: false, error: "Clave incorrecta" },
      { status: 401 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Error interno" },
      { status: 500 },
    );
  }
}
