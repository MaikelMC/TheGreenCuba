import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { siteConfig } from "@/config/site";

/**
 * De dónde salen las URL públicas del flujo de autenticación.
 *
 * El contenedor arranca con `HOSTNAME=0.0.0.0` y `PORT=3000` (ver `Dockerfile`),
 * y Next rellena `x-forwarded-host` con ese valor cuando la petición no trae un
 * `Host` público. A partir de ahí `request.url` vale `http://0.0.0.0:3000/...`, y
 * cualquier redirección construida con él manda al navegador a una dirección que
 * solo existe dentro del contenedor. Eso es exactamente lo que pasaba al volver
 * de Google: el verificador de sesión se cambiaba bien —la cookie se emitía— y
 * el salto siguiente apuntaba a `0.0.0.0:3000`.
 *
 * La regla es: mandan las cabeceras que pone el proxy (`x-forwarded-host` y
 * `x-forwarded-proto`), luego el `Host` de la petición, y solo si todo lo que
 * llega es interno se usa el dominio canónico de `siteConfig.url`, que ya
 * distingue desarrollo de producción. Nunca se devuelve un host interno en
 * producción: antes se prefiere el dominio de reserva.
 */

const INTERNAL_HOSTNAMES = new Set([
  "0.0.0.0",
  "127.0.0.1",
  "::",
  "::1",
  "localhost",
]);

/** La primera entrada de una cabecera que puede venir repetida (`a, b`). */
function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first ? first : null;
}

/** `host` puede traer puerto y, en IPv6, corchetes. */
function hostnameOf(host: string): string {
  try {
    return new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return host.replace(/^\[|\]$/g, "");
  }
}

function isInternal(host: string): boolean {
  const hostname = hostnameOf(host).toLowerCase();
  return INTERNAL_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost");
}

/** Origen público de la petición, siempre con un host alcanzable por el navegador. */
export function publicOrigin(request: NextRequest): string {
  const candidates = [
    firstHeaderValue(request.headers.get("x-forwarded-host")),
    firstHeaderValue(request.headers.get("host")),
    request.nextUrl.host,
  ];
  const host = candidates.find((candidate): candidate is string => Boolean(candidate) && !isInternal(candidate!));

  if (!host) {
    return process.env.NODE_ENV === "production"
      ? siteConfig.url.replace(/\/$/, "")
      : request.nextUrl.origin;
  }

  const forwardedProto = firstHeaderValue(
    request.headers.get("x-forwarded-proto"),
  )?.toLowerCase();
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : process.env.NODE_ENV === "production"
        ? "https"
        : request.nextUrl.protocol.replace(":", "");

  return `${protocol === "http" ? "http" : "https"}://${host}`;
}

/**
 * Corrige el `Location` de una redirección que apunta a un host interno.
 *
 * El proxy construye sus redirecciones —la vuelta al login, entre otras— contra
 * `request.url`. Con un `request.url` interno, el navegador acaba en
 * `0.0.0.0:3000`. Se reescribe
 * solo cuando hace falta: si el destino ya es público, la respuesta se devuelve
 * intacta.
 */
export function forcePublicRedirect<T extends NextResponse>(
  response: T,
  request: NextRequest,
): T {
  const location = response.headers.get("location");
  if (!location) return response;

  let target: URL;
  try {
    target = new URL(location, request.url);
  } catch {
    return response;
  }

  if (!isInternal(target.host)) return response;

  const fixed = new URL(
    `${target.pathname}${target.search}${target.hash}`,
    publicOrigin(request),
  );
  response.headers.set("location", fixed.toString());
  return response;
}
