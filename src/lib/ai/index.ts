import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import { AI_CONFIG } from "@/config/site";
import { resolveProviders } from "./providers-store";

export interface ResolvedProvider {
  apiKey: string;
  baseURL?: string;
  model: string;
  name: string;
  vendor: "openai" | "gemini";
}

function baseUrl(provider: ResolvedProvider): string {
  return (provider.baseURL || "https://api.openai.com/v1").replace(/\/+$/, "");
}

/* Tope por proveedor. Sin él, un proveedor que se cuelga bloquea la cadena
   entera hasta que el navegador corta a los 28 s, aunque el siguiente tuviera
   la respuesta en un segundo. Gemini desde Cuba tarda entre 1 s y 32 s según
   el momento, así que el tope tiene que ser holgado pero dejar sitio al
   failover: 12 s deja el peor caso realista por debajo del corte del cliente. */
const PROVIDER_TIMEOUT_MS = 12_000;

function stripJson(text: string): string {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) return cleaned.slice(start, end + 1);
  return cleaned;
}

/** Ejecuta una llamada JSON contra un proveedor concreto. Lanza si falla. */
async function callProviderJSON<T>(
  provider: ResolvedProvider,
  opts: { system: string; user: string; maxTokens: number; temperature: number },
): Promise<T> {
  const { system, user, maxTokens, temperature } = opts;

  if (provider.vendor === "gemini") {
    const response = await fetch(
      `${baseUrl(provider)}/models/${provider.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "X-goog-api-key": provider.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`${provider.name} HTTP ${response.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return JSON.parse(stripJson(text)) as T;
  }

  // OpenAI-compatible (Mistral, OpenRouter, etc.)
  const response = await fetch(`${baseUrl(provider)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${provider.name} HTTP ${response.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return JSON.parse(stripJson(content)) as T;
}

/** Llamada JSON con failover: intenta cada proveedor en orden hasta que uno responda. */
export async function chatJSON<T>(
  opts: { system: string; user: string; maxTokens?: number; temperature?: number },
): Promise<{ data: T; provider: string }> {
  const providers = resolveProviders();
  if (providers.length === 0) {
    throw new Error(
      "No hay proveedores de IA configurados. Actívalo en el panel de administración.",
    );
  }

  const maxTokens = opts.maxTokens ?? AI_CONFIG.maxTokens;
  const temperature = opts.temperature ?? AI_CONFIG.temperature;
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const data = await callProviderJSON<T>(provider, {
        system: opts.system,
        user: opts.user,
        maxTokens,
        temperature,
      });
      return { data, provider: provider.name };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(
    `Todos los proveedores de IA fallaron. ${errors.join(" | ")}`,
  );
}

/** Stream de chat (asistente) usando el primer proveedor OpenAI-compatible. */
export function createAIStream(messages: ModelMessage[]) {
  const providers = resolveProviders();
  const provider = providers.find((p) => p.vendor === "openai") ?? providers[0];
  if (!provider) {
    throw new Error(
      "No hay un proveedor de IA compatible configurado para el asistente.",
    );
  }
  if (provider.vendor === "gemini") {
    throw new Error(
      "El asistente requiere un proveedor OpenAI-compatible (ej: Mistral).",
    );
  }
  const client = createOpenAI({
    apiKey: provider.apiKey,
    ...(provider.baseURL ? { baseURL: provider.baseURL } : {}),
  });
  return streamText({
    model: client(provider.model),
    system: AI_CONFIG.systemPrompt,
    messages,
    maxOutputTokens: AI_CONFIG.maxTokens,
    temperature: AI_CONFIG.temperature,
  });
}

/** Lugar del catálogo que el cliente envía para la búsqueda con IA. */
export interface CatalogPlace {
  id: string;
  name: string;
  category: string;
  barrio?: string;
  payments?: string[];
  schedule?: string;
  description?: string;
}

export interface PlaceMatch {
  id: string;
  reason: string;
}

export interface Recommendation {
  matches: PlaceMatch[];
  summary: string;
}

const RECOMMEND_SYSTEM = `Eres "La Verde", el asistente de recomendación de lugares en Cuba.
El usuario escribe una consulta en lenguaje natural y te da un catálogo de lugares reales en formato JSON.
Tu tarea: elegir los lugares del catálogo que mejor se ajustan a la consulta y explicar por qué.

Reglas:
- Devuelve SOLO JSON válido, sin Markdown, sin texto adicional.
- Formato exacto: {"matches":[{"id":"...","reason":"..."}],"summary":"..."}
- "matches" debe contener SOLO ids que existan en el catálogo recibido. Máximo 5, ordenados de mejor a peor ajuste.
- Cada "reason" es breve (1 frase, español cubano natural).
- "summary" es un párrafo corto y amable (2-3 frases, español cubano) que resuma lo que se encontró para el usuario.
- Considera: monedas (USD Clásica, CUP, USD, EUR), categoría, horarios, barrio/ciudad, y la descripción.
- Los pagos del catálogo vienen en código, no con su nombre largo: MLC = USD Clásica,
  CUP = peso cubano, USD = dólar, EUR = euro, TRANSFER = transferencia. Un lugar con
  "MLC" SÍ cumple la condición "acepta USD Clásica"; sin esta equivalencia devolvías
  cero resultados a la consulta de ejemplo del propio buscador.
- Si ningún lugar encaja, devuelve "matches" vacío y un "summary" que lo explique amablemente.`;

export async function recommendPlaces(
  query: string,
  catalog: CatalogPlace[],
): Promise<{ data: Recommendation; provider: string }> {
  const user = `Consulta del usuario:\n"${query}"\n\nCatálogo de lugares (JSON):\n${JSON.stringify(catalog)}`;
  return chatJSON<Recommendation>({
    system: RECOMMEND_SYSTEM,
    user,
    maxTokens: 700,
    temperature: 0.3,
  });
}

export async function parseNaturalLanguageQuery(
  query: string,
): Promise<{
  cleanedQuery: string;
  filters?: { category?: string; city?: string; vibe?: string[]; currency?: string[] };
}> {
  const system = `Analiza la consulta del usuario sobre lugares en Cuba y extrae:
1. La consulta limpia (sin palabras de filtro)
2. Filtros implícitos: categoría, ciudad, ambiente, moneda

Responde SOLO con JSON:
{ "cleanedQuery": "...", "filters": { "category": "...", "city": "...", "vibe": ["..."], "currency": ["..."] } }`;
  const { data } = await chatJSON<{
    cleanedQuery: string;
    filters?: { category?: string; city?: string; vibe?: string[]; currency?: string[] };
  }>({ system, user: query, temperature: 0.1 });
  return data;
}
