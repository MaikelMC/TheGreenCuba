import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Ruta por calles entre dos puntos, proxeada desde el navegador.
 *
 * Existe porque `src/lib/map/routing.ts` nació llamando a OSRM directamente
 * desde el navegador, y el CSP del sitio lleva `connect-src 'self'`: en
 * producción la llamada se bloqueaba y el mapa caía al respaldo de línea recta
 * sin que nada lo dijera. Aquí el navegador solo habla con este mismo origen.
 *
 * Ventaja de fondo: el día que se cambie de proveedor de rutas —el servidor
 * demo de OSRM limita a ~1 req/s y no es para producción— se cambia la URL en
 * este archivo y el cliente no se entera.
 */

const OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";
const OSRM_TIMEOUT_MS = 8000;

// El servidor demo de OSRM corta a ~1 req/s: sin freno, unos pocos usuarios
// bastan para que empiece a devolver 429 y el mapa caiga a líneas rectas.
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;

interface Point {
  lat: number;
  lng: number;
}

/** Acepta "lat,lng". Devuelve null si no son dos números dentro del planeta. */
function parsePoint(value: string | null): Point | null {
  if (!value) return null;
  const [latRaw, lngRaw, ...rest] = value.split(",");
  if (rest.length > 0) return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function bad(error: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas rutas seguidas. Intenta en un momento." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds ?? 60) },
      },
    );
  }

  const params = req.nextUrl.searchParams;
  const origin = parsePoint(params.get("from"));
  const dest = parsePoint(params.get("to"));
  if (!origin || !dest) {
    return bad("from y to son obligatorios, con formato lat,lng");
  }

  try {
    const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
    const url = `${OSRM_ENDPOINT}/${coords}?overview=full&geometries=geojson`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
      /* El trazado entre dos puntos fijos no cambia: se guarda un día y así el
         par origen-destino más repetido —"cómo llegar" a los lugares del
         centro— no vuelve a salir a OSRM. */
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return bad("El servicio de rutas no respondió", 502);
    }

    const data = (await res.json()) as {
      code?: string;
      routes?: {
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: number[][] };
      }[];
    };
    const route = data.code === "Ok" ? data.routes?.[0] : undefined;
    const geometry = route?.geometry?.coordinates;
    if (!route || !geometry || geometry.length < 2) {
      return bad("Sin ruta por calles entre esos dos puntos", 404);
    }

    // OSRM devuelve [lng, lat]; el mapa espera [lat, lng].
    const coordinates = geometry.map(([lng, lat]) => [lat, lng]);

    return NextResponse.json({
      ok: true,
      coordinates,
      distanceM: route.distance ?? 0,
      durationSec: route.duration ?? 0,
    });
  } catch (error) {
    console.error("[api/route]", error);
    return bad("No se pudo calcular la ruta", 503);
  }
}
