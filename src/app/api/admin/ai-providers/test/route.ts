import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import { getActiveProvider, readProviders } from "@/lib/ai/providers-store";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as {
      id?: string;
      apiKey?: string;
      baseURL?: string;
      model?: string;
      vendor?: "openai" | "gemini";
    };

    const stored = body.id ? readProviders().find((p) => p.id === body.id) : null;
    const active = getActiveProvider();

    const apiKey =
      stored?.apiKey ?? body.apiKey ?? active?.apiKey ?? "";
    const baseURL =
      stored?.baseURL ?? body.baseURL ?? active?.baseURL;
    const model =
      stored?.model ?? body.model ?? active?.model ?? "";
    const vendor = stored?.vendor ?? body.vendor ?? "openai";

    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        error: "No hay una API key configurada en este proveedor.",
      });
    }

    const base = (baseURL ?? "https://api.openai.com/v1").replace(/\/+$/, "");

    let ok = false;
    let detail = "";

    if (vendor === "gemini") {
      const res = await fetch(`${base}/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "X-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Responde únicamente: ok" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({
          ok: false,
          error: `HTTP ${res.status}: ${text.slice(0, 300)}`,
        });
      }
      ok = true;
      detail = `Conexión exitosa con ${model} (Gemini)`;
    } else {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Responde únicamente: ok" }],
          max_tokens: 5,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({
          ok: false,
          error: `HTTP ${res.status}: ${text.slice(0, 300)}`,
        });
      }
      ok = true;
      detail = `Conexión exitosa con ${model}`;
    }

    return NextResponse.json({ ok, detail });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
