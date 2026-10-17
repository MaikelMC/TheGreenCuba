import { NextRequest, NextResponse } from "next/server";
import { canManagePlace } from "@/lib/admin-server";
import { getPlaceById } from "@/lib/db/queries";
import { generarVariantesPublicacion } from "@/lib/ai/publicaciones";
import {
  MAX_PROMPT,
  perfilDesdePlace,
  type ProductoParaPost,
} from "@/lib/publicaciones";
import { puede } from "@/lib/plans-server";
import { ganchosRecientesDe } from "@/lib/publicaciones-server";
import { siteConfig } from "@/config/site";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

/* Límite de peticiones por IP: cada variante son tokens de LLM pagados. Se
   comparte el cubo con el resto de rutas de IA por ruta —ver `rate-limit.ts`—. */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

/**
 * Redacta dos variantes del post a partir de la ficha del negocio, para el panel
 * del dueño.
 *
 * Es el mismo generador que el de administración —`generarVariantesPublicacion`—
 * y la misma idea: **no guarda nada**. Devuelve las variantes y la pantalla
 * decide; guardar es otra llamada, y así se puede pedir otra tanda sin gastar
 * plazas del tope semanal ni dejar basura si el texto no convence.
 *
 * El permiso del plan sí se comprueba —es la función que se está usando—, pero
 * el tope semanal no: generar no ocupa plaza; la ocupa guardar.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Demasiadas generaciones. Intenta en un momento." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds ?? 60) },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON inválido" },
      { status: 400 },
    );
  }

  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
  if (!placeId) {
    return NextResponse.json({ error: "Falta placeId" }, { status: 400 });
  }
  if (!(await canManagePlace(req, placeId))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const place = await getPlaceById(placeId);
  if (!place) {
    return NextResponse.json(
      { error: "Negocio no encontrado" },
      { status: 404 },
    );
  }

  if (!(await puede(placeId, "publicaciones_fb"))) {
    return NextResponse.json(
      {
        error:
          "Las publicaciones de Facebook entran con el módulo Facebook o con Publicidad Max.",
      },
      { status: 403 },
    );
  }

  /* El producto se busca **en la carta de este negocio**, no en la del cliente:
     un id ajeno no puede colarse en el prompt. Si no aparece, es un error del
     formulario y se dice, en vez de generar un texto sobre otro producto. */
  const productoId =
    typeof body.productoId === "string" ? body.productoId.trim() : "";
  let producto: ProductoParaPost | undefined;
  if (productoId) {
    const item = place.menu.find((p) => p.id === productoId);
    if (!item) {
      return NextResponse.json(
        { error: "El producto no está en tu carta." },
        { status: 400 },
      );
    }
    producto = { nombre: item.name, precio: item.price?.trim() || undefined };
  }

  const prompt =
    typeof body.prompt === "string"
      ? body.prompt.trim().slice(0, MAX_PROMPT)
      : "";
  /* El destacado entra en el perfil aunque el corte de ocho productos lo haya
     dejado fuera: es el eje del post. */
  const perfil = perfilDesdePlace(
    place,
    siteConfig.url,
    Date.now(),
    productoId || undefined,
  );
  /* Si el negocio ya publicó, sus ganchos viajan para que el modelo no repita
     el mismo arranque. Una tabla vacía no es un error. */
  const ganchosRecientes = await ganchosRecientesDe(placeId).catch(() => []);

  try {
    const { variantes, provider, fallback, datosEscasos } =
      await generarVariantesPublicacion(perfil, {
        prompt: prompt || undefined,
        producto,
        ganchosRecientes,
        direccion: place.address || undefined,
      });
    if (variantes.length === 0) {
      return NextResponse.json(
        { error: "La IA no devolvió ninguna variante. Intenta de nuevo." },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      variantes,
      provider,
      fallback,
      datosEscasos,
      enlacePerfil: perfil.enlacePerfil,
    });
  } catch (error) {
    console.error("[api/business/publicaciones/generar]", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message.slice(0, 200) }, { status: 503 });
  }
}
