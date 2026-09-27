import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-server";
import { stripJson } from "@/lib/ai";
import { readProviders } from "@/lib/ai/providers-store";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Tope de la prueba. Holgado frente a los ~1,5 s reales de un proveedor sano,
    corto frente a la paciencia de quien acaba de pulsar el botón. */
const TEST_TIMEOUT_MS = 20_000;

/* La prueba lanza **la petición que hace la app**, no una de cortesía.

   Antes mandaba «Responde únicamente: ok» con 5 tokens y daba por bueno
   cualquier HTTP 200. OpenRouter contestaba 200 gastándose los 5 tokens en su
   traza de razonamiento —`finish_reason: "length"` y el contenido cortado a
   medias—, y el panel enseñaba «Conexión exitosa» para un proveedor que no
   puede completar una búsqueda. Un visto bueno que no distingue eso no sirve
   para nada.

   El veredicto es ahora el mismo que el de `chatJSON`: hay contenido y es
   JSON. Se pide un JSON pequeño y barato, pero con `response_format` /
   `responseMimeType`, que es justo lo que un proveedor puede rechazar. */
const SYSTEM = "Eres un verificador de conexión. Obedece literalmente.";
const PROMPT =
  'Devuelve SOLO este JSON, sin texto alrededor: {"ok":true,"ciudad":"Santiago de Cuba"}';

/** El mensaje del proveedor, no el JSON crudo: en un toast entra lo que el
    error dice —«Rate limit exceeded»—, no la envoltura que lo trae. */
function reason(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      message?: string;
      error?: string | { message?: string };
    };
    const inner =
      typeof parsed.error === "object" ? parsed.error?.message : parsed.error;
    const message = inner ?? parsed.message ?? "";
    return (message || body).slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}

function httpFailure(res: Response, body: string): NextResponse {
  const detail = reason(body);
  return NextResponse.json({
    ok: false,
    error: detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}.`,
  });
}

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

    /* Con `id`, el proveedor tiene que existir. Antes, un id que no estaba
       caía en silencio al proveedor activo y el botón de un proveedor borrado
       daba el visto bueno de otro. */
    const stored = body.id
      ? (readProviders().find((p) => p.id === body.id) ?? null)
      : null;
    if (body.id && !stored) {
      return NextResponse.json(
        { ok: false, error: "Ese proveedor ya no existe. Recarga la página." },
        { status: 404 },
      );
    }

    const apiKey = stored?.apiKey ?? body.apiKey ?? "";
    const baseURL = stored?.baseURL ?? body.baseURL;
    const model = stored?.model ?? body.model ?? "";
    const vendor = stored?.vendor ?? body.vendor ?? "openai";

    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        error: "No hay una API key configurada en este proveedor.",
      });
    }
    if (!model) {
      return NextResponse.json({
        ok: false,
        error: "No hay un modelo configurado en este proveedor.",
      });
    }

    const base = (baseURL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    const signal = AbortSignal.timeout(TEST_TIMEOUT_MS);

    let text = "";
    if (vendor === "gemini") {
      const res = await fetch(`${base}/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "X-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${SYSTEM}\n\n${PROMPT}` }] },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 100,
            responseMimeType: "application/json",
          },
        }),
        signal,
      });
      if (!res.ok) return httpFailure(res, await res.text().catch(() => ""));
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } else {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: PROMPT },
          ],
          temperature: 0.3,
          max_tokens: 100,
          response_format: { type: "json_object" },
        }),
        signal,
      });
      if (!res.ok) return httpFailure(res, await res.text().catch(() => ""));
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      text = data.choices?.[0]?.message?.content ?? "";
    }

    /* Un 200 con el contenido vacío no es una conexión que sirva: es un
       proveedor que contesta y no responde. */
    if (!text.trim()) {
      return NextResponse.json({
        ok: false,
        error:
          `HTTP 200, pero la respuesta vino vacía. El modelo «${model}» contesta ` +
          "y no produce nada: revisa la cuota y el nombre del modelo.",
      });
    }

    try {
      JSON.parse(stripJson(text));
    } catch {
      return NextResponse.json({
        ok: false,
        error: `Respondió, pero no con JSON válido: ${text.slice(0, 200)}`,
      });
    }

    return NextResponse.json({
      ok: true,
      detail: `Conexión exitosa con ${model}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ok: false,
      error: /abort/i.test(message)
        ? `El proveedor no respondió en ${TEST_TIMEOUT_MS / 1000} s.`
        : message,
    });
  }
}
