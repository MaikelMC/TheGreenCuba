import fs from "node:fs";
import path from "node:path";

/** Estilo de request del proveedor. */
export type AiVendor = "openai" | "gemini";

/**
 * Campos de un proveedor.
 *
 * Aquí hubo un `type: "openai" | "custom"` que decidía si el proveedor era de
 * serie o traía URL propia. Dejó de significar algo en cuanto entró `vendor`:
 * lo que separa un proveedor de otro no es de dónde salió, sino cómo hay que
 * hablarle —`/chat/completions` con Bearer o `:generateContent` con
 * `X-goog-api-key`—, y eso es `vendor`. `type` sobrevivía pintando una
 * etiqueta y un icono, y el formulario ofrecía un desplegable con una sola
 * opción. Se fue.
 */
export interface AiProvider {
  id: string;
  name: string;
  /** Estilo de API: openai (Bearer /chat/completions) o gemini (X-goog-api-key /generateContent). */
  vendor?: AiVendor;
  baseURL?: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  priority: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "ai-providers.json");

/** Caché en memoria (write-through): evita leer/parsear el archivo en cada request de IA. */
let cachedProviders: AiProvider[] | null = null;

/**
 * Modelos gratuitos por defecto de cada proveedor.
 * `gemini-flash-lite-latest` es la familia vigente: los `gemini-2.5-*` ya no
 * están disponibles para cuentas nuevas (404 "no longer available to new users")
 * y los `gemini-3.x-flash` devuelven 503 por demanda alta.
 *
 * El modelo sale de `process.env.<PROVEEDOR>_MODEL`, y una variable **vacía**
 * cuenta como ausente. Con `??` no contaba: una casilla guardada en blanco en el
 * panel de variables de Vercel pasaba tal cual, el cuerpo iba con `model: ""` y
 * Mistral contestaba «Missing model parameter» a todas las búsquedas. De ahí el
 * `?.trim() ||` en vez del `??`.
 */
const DEFAULT_MODELS = {
  mistral: "mistral-small-latest",
  openrouter: "nvidia/nemotron-3-super-120b-a12b:free",
  gemini: "gemini-flash-lite-latest",
  groq: "openai/gpt-oss-120b",
  cerebras: "gpt-oss-120b",
  deepseek: "deepseek-chat",
} as const;

function makeId(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
}

/** Proveedores por defecto construidos desde las claves del entorno. */
function buildEnvProviders(): AiProvider[] {
  const providers: AiProvider[] = [];
  if (process.env.MISTRAL_API_KEY) {
    providers.push({
      id: makeId("Mistral"),
      name: "Mistral",
      vendor: "openai",
      baseURL: "https://api.mistral.ai/v1",
      apiKey: process.env.MISTRAL_API_KEY,
      model: process.env.MISTRAL_MODEL?.trim() || DEFAULT_MODELS.mistral,
      enabled: true,
      priority: 5,
    });
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      id: makeId("OpenRouter"),
      name: "OpenRouter",
      vendor: "openai",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODELS.openrouter,
      enabled: false,
      priority: 4,
    });
  }
  /* Groq: compatible con OpenAI y admite `response_format: json_object`, así
     que entra por el camino `openai` y sirve también al asistente. Medido el
     27/09/2026 con la consulta real de búsqueda: 8,7 s, frente a los 27,7 s del
     plan gratuito de OpenRouter. Va por delante de él y por detrás de Gemini
     (1,5 s), que es el único más rápido. */
  if (process.env.GROQ_API_KEY) {
    providers.push({
      id: makeId("Groq"),
      name: "Groq",
      vendor: "openai",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL?.trim() || DEFAULT_MODELS.groq,
      enabled: true,
      priority: 3,
    });
  }
  // Gemini primero: es el proveedor más fiable de la cadena hoy (los planes
  // gratis de Cerebras/OpenRouter agotan cuota con frecuencia).
  if (process.env.GEMINI_API_KEY) {
    providers.push({
      id: makeId("Gemini"),
      name: "Gemini",
      vendor: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODELS.gemini,
      enabled: true,
      priority: 1,
    });
    /* La misma clave y el mismo modelo, por el endpoint compatible con OpenAI.
       No es duplicar por duplicar: `createAIStream` solo acepta proveedores con
       `vendor: "openai"`, así que con la entrada de arriba sola el asistente del
       chat **nunca** usa Gemini —cae a OpenRouter, el siguiente de la lista— por
       mucho que Gemini sea la prioridad 1. Sin esta entrada, el panel enseñaba
       a Gemini como el primero de la cadena mientras el chat lo ignoraba.

       `buildEnvProviders` es el único camino que tiene producción: allí `data/`
       no existe, el panel no puede escribir (disco de solo lectura) y la lista
       sale entera de aquí. */
    providers.push({
      id: makeId("Gemini asistente"),
      name: "Gemini (asistente)",
      vendor: "openai",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODELS.gemini,
      enabled: true,
      priority: 2,
    });
  }
  // Cerebras: API compatible con OpenAI (Bearer + /chat/completions) y soporta
  // `response_format: json_object`, así que entra por el camino `openai`.
  if (process.env.CEREBRAS_API_KEY) {
    providers.push({
      id: makeId("Cerebras"),
      name: "Cerebras",
      vendor: "openai",
      baseURL: "https://api.cerebras.ai/v1",
      apiKey: process.env.CEREBRAS_API_KEY,
      model: process.env.CEREBRAS_MODEL?.trim() || DEFAULT_MODELS.cerebras,
      enabled: true,
      priority: 6,
    });
  }
  // DeepSeek: compatible con OpenAI (Bearer + /chat/completions) y admite
  // `response_format: json_object`, así que entra por el camino `openai`. Va el
  // último para no mover el orden ya medido de la cadena: probado el 10/10/2026
  // desde aquí dio 8,8 s, en la liga de Groq (8,7 s) y muy por delante de
  // OpenRouter (27,7 s), así que subirlo estaría justificado —una línea, o desde
  // el panel de proveedores—, pero eso es una decisión aparte de darlo de alta.
  if (process.env.DEEPSEEK_API_KEY) {
    providers.push({
      id: makeId("DeepSeek"),
      name: "DeepSeek",
      vendor: "openai",
      baseURL: "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODELS.deepseek,
      enabled: true,
      priority: 7,
    });
  }
  return providers;
}

/** Si el archivo no existe o está vacío, lo siembra con los proveedores del entorno. */
export function ensureProvidersSeeded(): void {
  try {
    if (!fs.existsSync(FILE)) {
      writeProviders(buildEnvProviders());
      return;
    }
    const raw = fs.readFileSync(FILE, "utf-8");
    const isEmpty =
      !raw.trim() ||
      (() => {
        try {
          const parsed = JSON.parse(raw) as unknown;
          return Array.isArray(parsed) && parsed.length === 0;
        } catch {
          return false;
        }
      })();
    if (isEmpty) {
      writeProviders(buildEnvProviders());
    }
  } catch {
    // ignore
  }
}

export function readProviders(): AiProvider[] {
  if (cachedProviders) return cachedProviders;
  let result: AiProvider[] = [];
  try {
    ensureProvidersSeeded();
    if (cachedProviders) return cachedProviders;
    if (!fs.existsSync(FILE)) {
      /* Sin archivo no hay proveedores **editables**, pero eso no significa que
         no haya proveedores: los del entorno están ahí. Devolver la lista vacía
         dejaba la IA muerta en todo despliegue, porque `data/` está en el
         `.gitignore` y el disco de una función serverless es de solo lectura
         —`ensureProvidersSeeded()` no puede escribir el archivo, y de rebote
         tampoco valía leerlo—. En local el archivo existe y manda él.

         El efecto era el peor de los posibles: en la máquina de desarrollo todo
         funcionaba y en producción la búsqueda devolvía 503 sin más pista que
         «Todos los proveedores fallaron», con las claves puestas y correctas. */
      cachedProviders = buildEnvProviders();
      return cachedProviders;
    }
    const raw = fs.readFileSync(FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      result = parsed.filter(
        (p) =>
          !!p &&
          typeof p.id === "string" &&
          typeof p.name === "string" &&
          typeof p.apiKey === "string" &&
          typeof p.model === "string",
      ) as AiProvider[];
    }
  } catch {
    result = [];
  }
  cachedProviders = result;
  return result;
}

export function writeProviders(providers: AiProvider[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(providers, null, 2), "utf-8");
  cachedProviders = providers;
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 3)}••••••${key.slice(-4)}`;
}

/** Proveedor habilitado con menor prioridad (mayor prioridad de uso). */
export function getActiveProvider(): AiProvider | null {
  const providers = getActiveProviders();
  return providers[0] ?? null;
}

/** Lista de proveedores habilitados ordenados por prioridad. */
export function getActiveProviders(): AiProvider[] {
  ensureProvidersSeeded();
  return readProviders()
    .filter((p) => p.enabled)
    .sort((a, b) => a.priority - b.priority);
}

/** Dataset de proveedores habilitados en orden de uso, para failover. */
export function resolveProviders(): {
  apiKey: string;
  baseURL?: string;
  model: string;
  name: string;
  vendor: AiVendor;
}[] {
  const providers = getActiveProviders();
  if (providers.length > 0) {
    return providers.map((p) => ({
      apiKey: p.apiKey,
      baseURL: p.baseURL || undefined,
      model: p.model,
      name: p.name,
      vendor: p.vendor ?? "openai",
    }));
  }
  // Fallback: sin proveedores configurados, usar Mistral del entorno si existe.
  if (process.env.MISTRAL_API_KEY) {
    return [
      {
        apiKey: process.env.MISTRAL_API_KEY,
        baseURL: "https://api.mistral.ai/v1",
        model: process.env.MISTRAL_MODEL?.trim() || DEFAULT_MODELS.mistral,
        name: "Mistral (env)",
        vendor: "openai",
      },
    ];
  }
  return [];
}

/** Configuración efectiva de un único proveedor (compat). */
export function resolveProvider(): {
  apiKey: string;
  baseURL?: string;
  model: string;
  name: string;
  vendor: AiVendor;
} {
  const first = resolveProviders()[0];
  if (!first) {
    throw new Error(
      "No hay un proveedor de IA activo configurado.",
    );
  }
  return first;
}