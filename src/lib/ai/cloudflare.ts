/**
 * Cloudflare Workers AI para La Verde: embeddings y generación de texto.
 *
 * Dos transportes, una sola firma:
 *
 * - **Binding (`env.AI`)** cuando el código corre en un Worker. Ahí no hay
 *   token que valga: el binding ya está autenticado. Se pasa en las opciones.
 * - **REST** en cualquier otro sitio (Next.js, scripts, pruebas), con
 *   `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN`.
 *
 * El segundo no es un plan B de adorno: esta app es Next.js con
 * `export const runtime = "nodejs"`, así que hoy corre por REST. El binding
 * empieza a usarse el día que se despliegue en Workers con OpenNext.
 *
 * Todo lo que sigue está comprobado contra la API real, no contra la
 * documentación: la forma de la respuesta de bge-m3, que glm-4.7-flash
 * devuelve `choices` y no `response`, y que es un modelo de razonamiento que
 * se come el presupuesto de tokens en `reasoning_content` y deja `content`
 * vacío.
 */

/* ─── Tipos ─── */

export type Role = "system" | "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

/**
 * Binding de Workers AI tal como lo expone el runtime.
 *
 * Es una interfaz propia y no un import de `@cloudflare/workers-types` a
 * propósito: esa dependencia trae el runtime entero de Workers a un proyecto
 * de Next.js para tipar tres líneas.
 */
export interface WorkersAIBinding {
  run(
    model: string,
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
}

export interface GenerateOptions {
  /** Tope de tokens de salida. Ver la nota de los modelos de razonamiento. */
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** `env.AI` en un Worker. Sin él se va por REST. */
  binding?: WorkersAIBinding;
  /** Fuerza un modelo concreto en vez de la cadena por defecto. */
  model?: string;
}

/** Error con el código HTTP de Cloudflare, para poder distinguir un 429. */
export class CloudflareAIError extends Error {
  readonly status: number;
  readonly code: number | null;
  readonly model: string;

  constructor(
    message: string,
    opts: { status?: number; code?: number | null; model: string },
  ) {
    super(message);
    this.name = "CloudflareAIError";
    this.status = opts.status ?? 0;
    this.code = opts.code ?? null;
    this.model = opts.model;
  }
}

/* ─── Modelos ─── */

export const CF_MODELS = {
  /** 1024 dimensiones. Verificado contra la API. */
  embeddings: "@cf/baai/bge-m3",
  generation: "@cf/zai-org/glm-4.7-flash",
  generationFallback: "@cf/google/gemma-4-26b-a4b-it",
} as const;

/** Dimensión de bge-m3. Tiene que coincidir con el `vector(N)` de pgvector. */
export const EMBEDDING_DIM = 1024;

/* ─── Transporte ─── */

const BASE = "https://api.cloudflare.com/client/v4/accounts";

/* Sin tope, una llamada al modelo de razonamiento se queda colgada hasta que
   corta la plataforma. 60 s deja sitio a los modelos lentos sin que la función
   serverless muera antes. */
const DEFAULT_TIMEOUT_MS = 60_000;

/* Un 429 de Workers AI es un límite por minuto, no un rechazo: reintentar con
   espera creciente resuelve la mayoría. Tres intentos y ni uno más — el
   usuario está esperando delante de la pantalla. */
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 600;

function credentials(): { accountId: string; token: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !token) {
    throw new Error(
      "Faltan CLOUDFLARE_ACCOUNT_ID o CLOUDFLARE_API_TOKEN. " +
        "Ponlos en .env (o pasa `binding` si esto corre en un Worker).",
    );
  }
  return { accountId, token };
}

function messageOf(errors: unknown): string {
  if (!Array.isArray(errors) || errors.length === 0) return "";
  const first = errors[0] as { message?: unknown; code?: unknown };
  const msg = typeof first?.message === "string" ? first.message : "";
  return msg;
}

function codeOf(errors: unknown): number | null {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const code = (errors[0] as { code?: unknown })?.code;
  return typeof code === "number" ? code : null;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    });
  });
}

/** Espera que pide el servidor, o la del backoff exponencial. */
function retryDelayMs(res: Response, attempt: number): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 30) * 1000;
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, Math.min(date - Date.now(), 30_000));
  }
  return RETRY_BASE_MS * 2 ** attempt;
}

/**
 * Una llamada al modelo, por binding o por REST, con reintentos.
 *
 * Devuelve `result` tal cual, sin normalizar: quien llama sabe si pidió
 * embeddings o chat y qué forma tiene la respuesta.
 */
async function runModel(
  model: string,
  input: Record<string, unknown>,
  opts: GenerateOptions,
): Promise<unknown> {
  const { binding, signal } = opts;
  const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  /* `AbortSignal.any` deja que corte lo que llegue antes: el tope de tiempo o
     el aborto de quien llama (el navegador cerrando la pestaña). */
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  if (binding) {
    try {
      const result = await binding.run(model, input, { signal: combined });
      if (result === null || result === undefined) {
        throw new CloudflareAIError("El binding devolvió vacío.", { model });
      }
      return result;
    } catch (error) {
      if (error instanceof CloudflareAIError) throw error;
      throw new CloudflareAIError(
        error instanceof Error ? error.message : String(error),
        { model },
      );
    }
  }

  const { accountId, token } = credentials();
  const url = `${BASE}/${accountId}/ai/run/${model}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        signal: combined,
      });
    } catch (error) {
      /* Red caída o timeout. Se reintenta: desde Cuba esto pasa a diario. */
      lastError = new CloudflareAIError(
        error instanceof Error ? error.message : String(error),
        { model },
      );
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_BASE_MS * 2 ** attempt, signal);
        continue;
      }
      throw lastError;
    }

    if (res.ok) {
      /* Con `stream: true` la respuesta es un cuerpo SSE, no JSON. */
      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        return { __stream: res.body, model };
      }
      const json = (await res.json()) as { result?: unknown; errors?: unknown };
      return json.result ?? json;
    }

    /* 429 y 5xx se reintentan; el resto no, porque un 400 repetido da el mismo
       400 tres veces y hace esperar al usuario para nada. */
    const retriable = res.status === 429 || res.status >= 500;
    const raw = await res.text().catch(() => "");
    let parsed: { errors?: unknown } = {};
    try {
      parsed = JSON.parse(raw) as { errors?: unknown };
    } catch {
      /* Cloudflare no siempre devuelve JSON en los 5xx. */
    }
    const detail = messageOf(parsed.errors) || raw.slice(0, 200);
    lastError = new CloudflareAIError(
      `Cloudflare ${res.status}${detail ? `: ${detail}` : ""}`,
      { status: res.status, code: codeOf(parsed.errors), model },
    );

    if (!retriable || attempt === MAX_RETRIES - 1) throw lastError;
    await sleep(retryDelayMs(res, attempt), signal);
  }

  throw lastError ?? new CloudflareAIError("Falló sin detalle", { model });
}

/* ─── Embeddings ─── */

/** El vector como literal de pgvector: `'[0.1,0.2]'::vector`. */
export function toPgVector(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

/**
 * `true` si el modelo está caído o retirado, para poder probar el siguiente.
 *
 * Cloudflare cambia y retira modelos sin avisar; un 404 o un 5xxx de modelo
 * inexistente no se arregla reintentando, se arregla con otro modelo.
 */
function isModelUnavailable(error: unknown): boolean {
  if (!(error instanceof CloudflareAIError)) return false;
  return error.status === 404 || error.status === 410 || error.status >= 500;
}

function readEmbedding(result: unknown, model: string): number[] {
  const data = (result as { data?: unknown })?.data;
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new CloudflareAIError(
      `${model} no devolvió "data". Revisa la forma de la respuesta.`,
      { model },
    );
  }
  return data[0] as number[];
}

export async function generateEmbedding(text: string): Promise<number[]>;
export async function generateEmbedding(text: string[]): Promise<number[][]>;
export async function generateEmbedding(
  text: string | string[],
): Promise<number[] | number[][]> {
  const texts = Array.isArray(text) ? text : [text];
  if (texts.length === 0) return [];
  /* bge-m3 acepta lotes: una sola llamada para N textos sale mucho más barata
     que N llamadas, y la API ya está preparada para eso. */
  const result = await runModel(CF_MODELS.embeddings, { text: texts }, {});
  const data = (result as { data?: unknown })?.data;
  if (!Array.isArray(data)) {
    throw new CloudflareAIError(
      `${CF_MODELS.embeddings} no devolvió un array de vectores.`,
      { model: CF_MODELS.embeddings },
    );
  }
  return Array.isArray(text) ? (data as number[][]) : readEmbedding(result, CF_MODELS.embeddings);
}

/* ─── Generación ─── */

interface Completion {
  text: string;
  /** `"length"` cuando se agotó el presupuesto de tokens. */
  finish: string | null;
}

/**
 * Saca el texto de la respuesta, sea cual sea la forma.
 *
 * Los modelos nuevos (glm-4.7-flash, gemma-4) devuelven `choices` al estilo
 * OpenAI; los viejos devolvían `response`. Soportar las dos formas son cuatro
 * líneas y evita que cambiar de modelo rompa la app.
 */
function readCompletion(result: unknown): Completion {
  const r = result as { response?: unknown; choices?: unknown };
  if (typeof r?.response === "string" && r.response) {
    return { text: r.response, finish: null };
  }
  const choice = Array.isArray(r?.choices)
    ? (r.choices[0] as { message?: { content?: unknown }; finish_reason?: unknown })
    : undefined;
  const content = choice?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((part) =>
              typeof (part as { text?: unknown })?.text === "string"
                ? (part as { text: string }).text
                : "",
            )
            .join("")
        : "";
  return {
    text,
    finish: typeof choice?.finish_reason === "string" ? choice.finish_reason : null,
  };
}

/* Cadena de modelos: el principal y, si se cae, el de reserva. La lista va aquí
   y no repartida por el código para que cambiarla sea una línea. */
const CHAT_CHAIN = [CF_MODELS.generation, CF_MODELS.generationFallback];

function chatInput(
  messages: Message[],
  opts: GenerateOptions,
  stream: boolean,
): Record<string, unknown> {
  return {
    messages,
    /* 2048 por defecto y no 256: glm-4.7-flash razona antes de contestar y ese
       razonamiento sale del mismo presupuesto. Con 300 tokens gastó los 300 en
       `reasoning_content` y devolvió `content` vacío con
       `finish_reason: "length"`. Es el fallo más silencioso de esta API. */
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.4,
    ...(stream ? { stream: true } : {}),
  };
}

/**
 * Respuesta completa, sin streaming.
 *
 * `messages` es el array de chat estándar (`system`/`user`/`assistant`).
 * Si el modelo principal no está disponible, prueba el de reserva.
 */
export async function generateResponse(
  messages: Message[],
  options: GenerateOptions = {},
): Promise<string> {
  const chain = options.model ? [options.model] : CHAT_CHAIN;
  let lastError: Error | null = null;

  for (const model of chain) {
    try {
      const result = await runModel(model, chatInput(messages, options, false), options);
      const { text, finish } = readCompletion(result);

      if (!text.trim()) {
        /* Vacío con `length` no es una respuesta: es el modelo quedándose sin
           presupuesto a mitad del razonamiento. Devolver "" aquí haría que la
           app enseñara una tarjeta en blanco sin explicar nada. */
        const reason =
          finish === "length"
            ? `El modelo agotó los ${options.maxTokens ?? 2048} tokens razonando y no llegó a responder. Sube maxTokens.`
            : "El modelo devolvió una respuesta vacía.";
        lastError = new CloudflareAIError(reason, { model });
        continue;
      }
      return text;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      /* Solo se prueba el siguiente si el problema es el modelo. Un 429 no se
         arregla cambiando de modelo, se arregla esperando. */
      if (!isModelUnavailable(error)) throw error;
    }
  }

  throw lastError ?? new CloudflareAIError("Ningún modelo respondió", { model: "chat" });
}

/**
 * Respuesta en streaming, como texto plano listo para un `Response`.
 *
 * Devuelve un stream de texto —no de SSE— porque es lo que espera el
 * `fetch` del navegador y lo que ya devuelve `/api/ai` con el SDK.
 * Los chunks que no son texto (razonamiento, tool calls) se descartan.
 */
export async function generateResponseStream(
  messages: Message[],
  options: GenerateOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const chain = options.model ? [options.model] : CHAT_CHAIN;
  let lastError: Error | null = null;

  for (const model of chain) {
    try {
      const result = (await runModel(
        model,
        chatInput(messages, options, true),
        options,
      )) as { __stream?: ReadableStream<Uint8Array> | null };

      const body = result.__stream ?? (result as ReadableStream<Uint8Array>);
      if (!(body instanceof ReadableStream)) {
        throw new CloudflareAIError(
          `${model} no devolvió un stream. ¿Está el modelo caído?`,
          { model },
        );
      }
      return decodeSSE(body);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isModelUnavailable(error)) throw error;
    }
  }

  throw lastError ?? new CloudflareAIError("Ningún modelo transmitió", { model: "chat" });
}

/**
 * Convierte el SSE de Cloudflare en texto plano.
 *
 * El protocolo es el de OpenAI: líneas `data: {...}` con el trozo en
 * `choices[0].delta.content`, y `data: [DONE]` al final. Un `data:` puede
 * partirse entre dos chunks de red, así que se guarda el resto incompleto en
 * vez de parsear línea a línea sobre la marcha — que es como se pierden
 * respuestas de forma intermitente y difícil de reproducir.
 */
function decodeSSE(
  source: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            let parsed: { response?: unknown; choices?: unknown };
            try {
              parsed = JSON.parse(payload) as typeof parsed;
            } catch {
              continue; // chunk a medias o keep-alive
            }

            const choice = Array.isArray(parsed.choices)
              ? (parsed.choices[0] as { delta?: { content?: unknown } })
              : undefined;
            const piece =
              typeof choice?.delta?.content === "string"
                ? choice.delta.content
                : typeof parsed.response === "string"
                  ? parsed.response
                  : "";

            if (piece) controller.enqueue(encoder.encode(piece));
          }
        }
      } catch (error) {
        controller.error(error);
        return;
      } finally {
        reader.releaseLock();
      }
      controller.close();
    },
  });
}

/**
 * Health check. Sirve para el panel de administración: dice si el token sirve
 * y si el modelo responde, sin gastar en una generación larga.
 */
export async function checkCloudflareAI(
  options: GenerateOptions = {},
): Promise<{ ok: true; model: string; dim: number } | { ok: false; error: string }> {
  try {
    const vector = await generateEmbedding("prueba");
    return { ok: true, model: CF_MODELS.embeddings, dim: vector.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
