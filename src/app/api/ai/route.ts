import { NextRequest, NextResponse } from "next/server";
import { createAIStream } from "@/lib/ai";
import { getActiveProviders } from "@/lib/ai/providers-store";
import { rateLimit } from "@/lib/rate-limit";
import type { ModelMessage } from "ai";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_MESSAGES = 12;
const MAX_CHARS_TOTAL = 12000;
const MAX_CHARS_PER_MESSAGE = 4000;

// Límite de peticiones por IP: el asistente consume tokens de LLM pagados.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

function tooMany(retryAfterSeconds?: number): NextResponse {
  return NextResponse.json(
    { error: "Demasiadas solicitudes. Intenta en un momento." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds ?? 60) },
    },
  );
}

/** Filtra y valida el historial del chat. Nunca acepta roles "system" del cliente. */
function sanitizeMessages(value: unknown): ModelMessage[] | null {
  if (!Array.isArray(value)) return null;
  const out: ModelMessage[] = [];
  let total = 0;

  for (const raw of value.slice(0, MAX_MESSAGES)) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Record<string, unknown>;
    const role = m.role;
    if (role !== "user" && role !== "assistant") continue;

    let content = "";
    if (typeof m.content === "string") {
      content = m.content;
    } else if (Array.isArray(m.content)) {
      // Vercel AI SDK admite bloques de texto/URL de imagen; solo aceptamos texto.
      content = m.content
        .filter(
          (part): part is { type: string; text?: string } =>
            !!part && typeof part === "object" && (part as { type?: string }).type === "text",
        )
        .map((part) => part.text ?? "")
        .join("\n");
    }
    content = content.slice(0, MAX_CHARS_PER_MESSAGE);
    if (!content.trim()) continue;

    total += content.length;
    if (total > MAX_CHARS_TOTAL) break;

    out.push({ role, content });
  }

  if (out.length === 0) return null;
  return out;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limited.ok) return tooMany(limited.retryAfterSeconds);

  try {
    const body = (await req.json()) as { messages?: unknown };

    const messages = sanitizeMessages(body.messages);
    if (!messages) {
      return NextResponse.json(
        { error: "messages es obligatorio" },
        { status: 400 },
      );
    }

    const hasProvider = getActiveProviders().some(
      (p) => p.vendor === "openai" || p.vendor === "gemini",
    );
    if (!hasProvider) {
      return NextResponse.json(
        {
          error:
            "No hay un proveedor de IA activo. Agrégalo en el panel de administración.",
        },
        { status: 503 },
      );
    }

    const result = createAIStream(messages);
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[api/ai]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
