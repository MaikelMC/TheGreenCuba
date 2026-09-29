import { NextRequest, NextResponse } from "next/server";
import { recommendPlaces, type CatalogPlace } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_PLACES = 80;
const MAX_TEXT = 500;
const MAX_FIELD = 2000;

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

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
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
      lat,
      lng,
      category: cleanString(p.category) || "Otro",
      barrio: cleanString(p.barrio) || undefined,
      city: cleanString(p.city) || undefined,
      province: cleanString(p.province) || undefined,
      payments,
      schedule: cleanString(p.schedule) || undefined,
      description: cleanString(p.description) || undefined,
      distanceM:
        Number.isFinite(distance) && distance >= 0
          ? Math.min(Math.round(distance), 20_000_000)
          : undefined,
    });
  }
  return out;
}

const LOCATION_RULES = [
  { terms: ["varadero"], text: ["varadero", "matanzas"], bounds: { minLat: 23.02, maxLat: 23.25, minLng: -81.4, maxLng: -81.05 } },
  { terms: ["matanzas"], text: ["matanzas"], bounds: { minLat: 22.9, maxLat: 23.2, minLng: -81.8, maxLng: -81.0 } },
  { terms: ["la habana", "habana"], text: ["la habana", "habana"], bounds: { minLat: 22.9, maxLat: 23.2, minLng: -82.7, maxLng: -82.1 } },
  { terms: ["santiago", "santiago de cuba"], text: ["santiago", "santiago de cuba"], bounds: { minLat: 19.8, maxLat: 20.3, minLng: -76.2, maxLng: -75.5 } },
] as const;

function catalogForQuery(query: string, places: CatalogPlace[]): CatalogPlace[] {
  const normalizedQuery = normalize(query);
  const location = LOCATION_RULES.find((rule) => rule.terms.some((term) => normalizedQuery.includes(term)));
  const asksForHotel = /\bhotel(?:es)?\b|hospedaje|alojamiento/.test(normalizedQuery);

  return places.filter((place) => {
    if (location) {
      const searchable = normalize([place.name, place.category, place.barrio, place.city, place.province, place.description].filter(Boolean).join(" "));
      const textMatch = location.text.some((term) => searchable.includes(term));
      const coordinateMatch = place.lat >= location.bounds.minLat && place.lat <= location.bounds.maxLat && place.lng >= location.bounds.minLng && place.lng <= location.bounds.maxLng;
      if (!textMatch && !coordinateMatch) return false;
    }
    if (asksForHotel) {
      const searchable = normalize([place.name, place.category, place.description].filter(Boolean).join(" "));
      if (!/\bhotel(?:es)?\b|hospedaje|alojamiento/.test(searchable)) return false;
    }
    return true;
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limited.ok) return tooMany(limited.retryAfterSeconds);

  try {
    const body = (await req.json()) as { query?: unknown; places?: unknown };
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

    const candidates = catalogForQuery(query, places);
    if (candidates.length === 0) {
      return NextResponse.json({
        ok: true,
        matches: [],
        summary: "No encontré lugares que coincidan con esa ubicación y categoría en el catálogo de La Verde.",
        provider: "catalog-filter",
      });
    }

    const { data, provider } = await recommendPlaces(query, candidates);

    // Solo devolver ids de lugares que realmente existen en el catálogo enviado.
    const validIds = new Set(candidates.map((p) => p.id));
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