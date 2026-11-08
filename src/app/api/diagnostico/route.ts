import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { diagnosticos } from "@/lib/db/schema";
import { lt } from "drizzle-orm";

export const dynamic = "force-dynamic";

const TIPOS_VALIDOS = new Set([
  "navegador",
  "error",
  "mapa_cargado",
  "mapa_lento",
  "mapa_error",
  "mapa_abandonado",
]);

const LIMITE_PETICIONES = 20;
const VENTANA_MS = 60 * 60 * 1000; // 1 hora
const LIMITE_BYTES = 4 * 1024; // 4 KB

/** Marca para no limpiar más de una vez al día por instancia del proceso. */
let ultimaLimpieza = 0;

async function limpiarViejos(): Promise<void> {
  const ahora = Date.now();
  if (ahora - ultimaLimpieza < 24 * 60 * 60 * 1000) return;
  ultimaLimpieza = ahora;

  const corte = new Date(ahora - 30 * 24 * 60 * 60 * 1000);
  try {
    await db.delete(diagnosticos).where(lt(diagnosticos.creadoEn, corte));
  } catch {
    // Silencioso: no impide el guardado del diagnóstico actual.
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, LIMITE_PETICIONES, VENTANA_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas peticiones" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds ?? 60) },
      },
    );
  }

  /* Rechaza cuerpos grandes antes de parsear. */
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > LIMITE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Cuerpo demasiado grande" },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > LIMITE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Cuerpo demasiado grande" },
        { status: 413 },
      );
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "Cuerpo inválido" },
      { status: 400 },
    );
  }

  const { tipo, datos, id } = body as Record<string, unknown>;

  if (typeof tipo !== "string" || !TIPOS_VALIDOS.has(tipo)) {
    return NextResponse.json(
      { ok: false, error: "Tipo no válido" },
      { status: 400 },
    );
  }

  if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
    return NextResponse.json(
      { ok: false, error: "datos inválido" },
      { status: 400 },
    );
  }

  const idFinal =
    typeof id === "string" && id.length > 0 && id.length <= 64
      ? id
      : `diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await db.insert(diagnosticos).values({
      id: idFinal,
      tipo,
      datos: datos as Record<string, unknown>,
    });

    /* Limpieza asíncrona: no bloquea la respuesta al cliente. */
    void limpiarViejos();

    return NextResponse.json({ ok: true });
  } catch (err) {
    /* Conflicto de id duplicado: idempotente, ya se guardó. */
    if (err instanceof Error && err.message.includes("duplicate")) {
      return NextResponse.json({ ok: true });
    }
    console.error("[api/diagnostico]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "No se pudo guardar" },
      { status: 500 },
    );
  }
}
