import fs from "node:fs";
import path from "node:path";

export type AiProviderType = "openai" | "custom";

/** Estilo de request del proveedor. */
export type AiVendor = "openai" | "gemini";

export interface AiProvider {
  id: string;
  name: string;
  type: AiProviderType;
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

/** Modelos gratuitos por defecto de cada proveedor. */
const DEFAULT_MODELS = {
  mistral: "mistral-small-latest",
  openrouter: "nvidia/nemotron-3-super-120b-a12b:free",
  gemini: "gemini-flash-latest",
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
      type: "openai",
      vendor: "openai",
      baseURL: "https://api.mistral.ai/v1",
      apiKey: process.env.MISTRAL_API_KEY,
      model: process.env.MISTRAL_MODEL ?? DEFAULT_MODELS.mistral,
      enabled: true,
      priority: 1,
    });
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      id: makeId("OpenRouter"),
      name: "OpenRouter",
      type: "custom",
      vendor: "openai",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODELS.openrouter,
      enabled: false,
      priority: 2,
    });
  }
  if (process.env.GEMINI_API_KEY) {
    providers.push({
      id: makeId("Gemini"),
      name: "Gemini",
      type: "custom",
      vendor: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta",
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL ?? DEFAULT_MODELS.gemini,
      enabled: false,
      priority: 3,
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
      cachedProviders = result;
      return result;
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
        model: process.env.MISTRAL_MODEL ?? DEFAULT_MODELS.mistral,
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