import { NextRequest, NextResponse } from "next/server";
import { createAIStream } from "@/lib/ai";
import { getActiveProviders } from "@/lib/ai/providers-store";
import type { ModelMessage } from "ai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { messages?: unknown[] };

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
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

    const result = createAIStream(body.messages as ModelMessage[]);
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[api/ai]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
