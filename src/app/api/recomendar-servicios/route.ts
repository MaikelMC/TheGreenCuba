import { NextRequest, NextResponse } from "next/server";
import { chatJSON } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";
import { SERVICIOS } from "@/content/servicios";
import { CATEGORIAS } from "@/content/servicios-categorias";
import { MODULOS, type ClaveModulo } from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 30;

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;

// ── Tipos de respuesta ────────────────────────────────────────────────────────

/** Servicio que ya existe en La Verde (con precio y ficha). */
export type ServicioRecomendadoYa = {
  esProximo: false;
  slug: string;
  ficha: string | null;
  nombre: string;
  descripcionCorta: string;
  explicacion: string;
  precioUsd: number;
  claveModulo: string;
  nombreModulo: string;
  /**
   * true cuando el servicio no tiene precio propio: viene incluido dentro de
   * otro módulo que el pack ya contiene. Las tarjetas lo muestran como
   * "Incluido en X" para que el total del pack no sorprenda al usuario.
   */
  esIncluido: boolean;
};

/** Servicio próximo: todavía no existe, se contacta al equipo. */
export type ServicioRecomendadoProximo = {
  esProximo: true;
  nombre: string;
  explicacion: string;
};

export type ServicioRecomendado = ServicioRecomendadoYa | ServicioRecomendadoProximo;

export type RespuestaRecomendacion = {
  servicios: ServicioRecomendado[];
  /** Suma de módulos únicos ya disponibles. Los próximos no suman. */
  totalUsd: number;
};

// ── Catálogo para el prompt ───────────────────────────────────────────────────

/** Resumen de los servicios que ya existen, para el prompt de la IA. */
const CATALOGO_YA = SERVICIOS.map((s) => {
  const precioUsd =
    s.precio.tipo === "modulo" ? MODULOS[s.precio.clave].usd : MODULOS[s.precio.en].usd;
  return `  ya:"${s.slug}" nombre:"${s.nombre}" precio:$${precioUsd}/mes desc:"${s.descripcionCorta}"`;
}).join("\n");

/**
 * Genera el bloque de servicios próximos para el prompt, filtrando por la
 * categoría del usuario. Incluye siempre los de "cualquier-negocio" porque son
 * transversales, y añade los específicos de la categoría elegida.
 */
function catalogoProximo(categoriaSlug: string): string {
  const slugs = new Set([categoriaSlug, "cualquier-negocio"]);
  const nombres = new Set<string>();
  const lineas: string[] = [];

  for (const cat of CATEGORIAS) {
    if (!slugs.has(cat.slug)) continue;
    for (const s of cat.servicios) {
      if (s.estado !== "proximo" || nombres.has(s.nombre)) continue;
      nombres.add(s.nombre);
      lineas.push(`  proximo:"${s.nombre}" nombre:"${s.nombre}"`);
    }
  }
  return lineas.join("\n");
}

// ── Ruta POST ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta en un momento." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds ?? 60) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { categoriaSlug, categoria, descripcion, problemas } = body as Record<string, unknown>;
  if (
    typeof categoriaSlug !== "string" ||
    typeof categoria !== "string" ||
    typeof descripcion !== "string" ||
    typeof problemas !== "string" ||
    !categoriaSlug.trim() ||
    !descripcion.trim() ||
    !problemas.trim()
  ) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const proximo = catalogoProximo(categoriaSlug.trim());
  const system = `Eres un consultor de La Verde, una plataforma cubana para negocios locales.
Recomienda entre 3 y 5 servicios que mejor encajen con el negocio descrito.

Servicios disponibles (ya existen en La Verde):
${CATALOGO_YA}

Servicios próximos para esta categoría (en desarrollo, el negocio los puede solicitar):
${proximo || "  (ninguno específico para esta categoría)"}

Responde SOLO con JSON válido, con esta forma exacta:
{
  "servicios": [
    { "id": "...", "explicacion": "..." }
  ]
}

Reglas:
- Para servicios existentes: usa el valor del campo ya:"..." como id (ej. "carta-y-qr").
- Para servicios próximos: usa el valor del campo proximo:"..." como id (ej. "Sistema de gestión: inventario, caja y reportes"). El id DEBE ser exactamente el texto del campo proximo:"...".
- La explicación: 1–2 frases concretas sobre por qué ayuda A ESTE negocio, mencionando sus problemas o su forma de trabajar.
- No repitas el nombre del servicio en la explicación.
- Ordena de mayor a menor impacto esperado para ese negocio.
- Devuelve entre 3 y 5 servicios, ni más ni menos.
- Mezcla servicios existentes y próximos cuando tenga sentido.`;

  const user = `Categoría del negocio: ${String(categoria).trim().slice(0, 200)}
Cómo trabaja: ${descripcion.trim().slice(0, 800)}
Problemas que quiere resolver: ${problemas.trim().slice(0, 800)}`;

  try {
    const { data } = await chatJSON<{ servicios: { id: string; explicacion: string }[] }>({
      system,
      user,
      maxTokens: 700,
      temperature: 0.4,
    });

    if (!Array.isArray(data?.servicios)) {
      return NextResponse.json({ error: "Respuesta inesperada del modelo" }, { status: 502 });
    }

    // Recopila los ids de servicios próximos de la categoría para validar
    const idsProximos = new Set(catalogoProximo(categoriaSlug.trim()).match(/proximo:"([^"]+)"/g)?.map((m) => m.slice(9, -1)) ?? []);

    const slugsVistos = new Set<string>();
    const modulosUsados = new Set<ClaveModulo>();
    const servicios: ServicioRecomendado[] = [];

    for (const item of data.servicios.slice(0, 5)) {
      if (!item.id || typeof item.id !== "string") continue;

      const explicacion = String(item.explicacion ?? "").slice(0, 300);

      // ── Servicio ya existente ──
      const servicioYa = SERVICIOS.find((s) => s.slug === item.id);
      if (servicioYa) {
        if (slugsVistos.has(servicioYa.slug)) continue;
        slugsVistos.add(servicioYa.slug);

        const esIncluido = servicioYa.precio.tipo === "incluido";
        const claveModulo: ClaveModulo =
          servicioYa.precio.tipo === "incluido"
            ? servicioYa.precio.en
            : servicioYa.precio.clave;
        modulosUsados.add(claveModulo);

        // Busca la ficha en CATEGORIAS (cualquier entrada que tenga ese slug)
        let fichaSlug: string | null = null;
        for (const cat of CATEGORIAS) {
          const encontrado = cat.servicios.find((s) => s.ficha === servicioYa.slug);
          if (encontrado?.ficha) { fichaSlug = encontrado.ficha; break; }
        }

        servicios.push({
          esProximo: false,
          slug: servicioYa.slug,
          ficha: fichaSlug,
          nombre: servicioYa.nombre,
          descripcionCorta: servicioYa.descripcionCorta,
          explicacion,
          precioUsd: MODULOS[claveModulo].usd,
          claveModulo,
          nombreModulo: MODULOS[claveModulo].nombre,
          esIncluido,
        });
        continue;
      }

      // ── Servicio próximo ──
      if (idsProximos.has(item.id)) {
        if (slugsVistos.has(item.id)) continue;
        slugsVistos.add(item.id);
        servicios.push({
          esProximo: true,
          nombre: item.id,
          explicacion,
        });
      }
    }

    // totalUsd: suma de módulos únicos de servicios ya disponibles
    const totalUsd = [...modulosUsados].reduce((acc, clave) => acc + MODULOS[clave].usd, 0);

    return NextResponse.json({ servicios, totalUsd } satisfies RespuestaRecomendacion);
  } catch (err) {
    console.error("[api/recomendar-servicios]", err);
    return NextResponse.json({ error: "No se pudo generar la recomendación" }, { status: 502 });
  }
}
