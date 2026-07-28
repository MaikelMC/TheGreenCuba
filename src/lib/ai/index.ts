import { ai } from "@ai-sdk/openai";
import { streamText, type CoreMessage } from "ai";
import { AI_CONFIG } from "@/config/site";

export function createAIStream(messages: CoreMessage[]) {
  return streamText({
    model: ai(AI_CONFIG.model),
    system: AI_CONFIG.systemPrompt,
    messages,
    maxTokens: AI_CONFIG.maxTokens,
    temperature: AI_CONFIG.temperature,
  });
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  const data = (await response.json()) as { data: { embedding: number[] }[] };
  return data.data[0]!.embedding;
}

export async function parseNaturalLanguageQuery(
  query: string,
): Promise<{
  cleanedQuery: string;
  filters?: { category?: string; city?: string; vibe?: string[]; currency?: string[] };
}> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      messages: [
        {
          role: "system",
          content: `Analiza la consulta del usuario sobre lugares en Cuba y extrae:
1. La consulta limpia (sin palabras de filtro)
2. Filtros implícitos: categoría, ciudad, ambiente, moneda

Responde SOLO con JSON:
{ "cleanedQuery": "...", "filters": { "category": "...", "city": "...", "vibe": ["..."], "currency": ["..."] } }`,
        },
        { role: "user", content: query },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  return JSON.parse(data.choices[0]!.message.content) as ReturnType<typeof parseNaturalLanguageQuery>;
}
