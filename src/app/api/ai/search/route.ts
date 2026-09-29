import { NextRequest, NextResponse } from "next/server";
import { recommendPlaces, type CatalogPlace } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_PLACES = 80;
const MAX_TEXT = 500;
const MAX_FIELD = 2000;
/* Tope de la carta. El cliente ya recorta a doce entradas, pero el cliente no
   es de fiar: esta ruta la llama cualquiera con el cuerpo que quiera, y cada
   entrada es una línea que se le paga al modelo. */
const MAX_MENU_ITEMS = 12;
const MAX_MENU_LINE = 60;

// Límite de peticiones de IA por IP: protege el costo del LLM frente a abuso.
const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60 * 1000;

function tooMany(retryAfterSeconds?: number): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Demasiadas búsquedas. Intenta en un momento." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds ?? 60) },
    },
  );
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_FIELD) : "";
}

/**
 * Lista de cadenas, acotada por número de entradas y por largo de cada una.
 *
 * Un array vacío se devuelve como `undefined` y no como `[]`: las dos cosas se
 * serializan distinto y el modelo recibía un `"menu": []` que le dice «este
 * lugar tiene una carta» cuando lo que hay es un lugar sin carta publicada.
 */
function cleanList(value: unknown, max: number, maxLength: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, max);
  return out.length > 0 ? out : undefined;
}

function sanitizePlaces(value: unknown): CatalogPlace[] {
  if (!Array.isArray(value)) return [];
  const out: CatalogPlace[] = [];
  for (const raw of value.slice(0, MAX_PLACES)) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const id = cleanString(p.id);
    const name = cleanString(p.name);
    if (!id || !name) continue;
    const payments = Array.isArray(p.payments)
      ? p.payments
          .filter((x): x is string => typeof x === "string")
          .slice(0, 8)
      : undefined;
    /* La distancia la calcula el navegador, que es quien tiene la ubicación del
       usuario. Se acepta tal cual y se acota: es una pista de ordenación, no un
       dato que se enseñe, así que lo peor que puede hacer un valor inventado es
       desordenar la lista. */
    const distance = Number(p.distanceM);
    out.push({
      id,
      name,
      category: cleanString(p.category) || "Otro",
      barrio: cleanString(p.barrio) || undefined,
      payments,
      schedule: cleanString(p.schedule) || undefined,
      description: cleanString(p.description) || undefined,
      menu: cleanList(p.menu, MAX_MENU_ITEMS, MAX_MENU_LINE),
      distanceM:
        Number.isFinite(distance) && distance >= 0
          ? Math.min(Math.round(distance), 20_000_000)
          : undefined,
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limited.ok) return tooMany(limited.retryAfterSeconds);

  try {
    const body = (await req.json()) as { query?: unknown; places?: unknown; userProvince?: unknown };
    const query = cleanString(body.query).trim();
    if (!query) {
      return NextResponse.json(
        { ok: false, error: "query es obligatorio" },
        { status: 400 },
      );
    }
    if (query.length > MAX_TEXT) {
      return NextResponse.json(
        { ok: false, error: "query demasiado largo" },
        { status: 400 },
      );
    }
    const places = sanitizePlaces(body.places);
    if (places.length === 0) {
      return NextResponse.json(
        { ok: false, error: "places no contiene lugares válidos" },
        { status: 400 },
      );
    }

    /* La provincia del usuario viaja con la consulta: es la pieza que falta
       cuando no hay GPS —sin distancia ni provincia el modelo elegía por
       puro parecido semántico y recomendaba negocios de otra provincia a
       alguien que nunca podría ir hoy. Vacío o no string = no se conoce. */
    const userProvince =
      typeof body.userProvince === "string" && body.userProvince.trim()
        ? cleanString(body.userProvince).trim()
        : null;

    const { data, provider } = await recommendPlaces(query, places, userProvince);

    // Solo devolver ids de lugares que realmente existen en el catálogo enviado.
    const validIds = new Set(places.map((p) => p.id));
    const matches = (data.matches ?? []).filter((m) => validIds.has(m.id)).slice(0, 5);

    return NextResponse.json({
      ok: true,
      matches,
      summary: typeof data.summary === "string" ? data.summary.slice(0, 600) : "",
      provider,
    });
  } catch (error) {
    console.error("[api/ai/search]", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json(
      { ok: false, error: message.slice(0, 200) },
      { status: 503 },
    );
  }
}