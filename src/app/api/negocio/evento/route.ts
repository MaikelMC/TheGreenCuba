import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { getAppUser } from "@/lib/auth/user";
import { MAX_EVENTOS, parsearEvento } from "@/lib/eventos";
import {
  diaUtc,
  esDueno,
  registrarEventos,
  type EventoResuelto,
} from "@/lib/eventos-server";
import { DEV_PLACE_ID, ownsDevPlace } from "@/lib/dev-place";
import { rateLimit } from "@/lib/rate-limit";

/**
 * El punto donde entra el tráfico de la ficha y de la carta.
 *
 * Es público a propósito: lo llama cualquier visitante, casi siempre sin
 * sesión, y pedirle autenticación dejaría fuera a todo el mundo. De ahí que todo
 * lo que entra se filtre antes de tocar la base:
 *
 * - **Bots fuera, por `user-agent`.** Los buscadores inflarían las visitas y el
 *   dueño leería un número que no es gente.
 * - **El dueño fuera.** Mirar tu propia ficha no es una visita; si contara, el
 *   panel mentiría justo a quien lo abre.
 * - **Un tope por IP.** No es una frontera comercial, es antiabuso: sin él,
 *   cualquiera infla el panel con un bucle.
 *
 * **Sin datos personales.** El visitante único es el hash de la cookie anónima
 * `lv_anon` junto al negocio y al **día**: al día siguiente ese hash ya no vale
 * para reconocer a nadie, y la base nunca ve la cookie. La IP se usa para el
 * tope y se tira; no se guarda.
 */

/**
 * Firmas de rastreador, por `user-agent`.
 *
 * **`^whatsapp` va anclado al principio y no es un capricho.** El rastreador que
 * arma la vista previa de un enlace se identifica como `WhatsApp/2.x` a secas,
 * pero el **navegador interno** de WhatsApp —el que abre la carta cuando alguien
 * toca el enlace en un chat— lleva `Mozilla/5.0 (... WhatsApp/2.x)`. Un `/whatsapp/i`
 * suelto tira a los dos, y en Cuba eso es tirar la mayoría del tráfico bueno.
 * Anclado, caza al rastreador y deja pasar al visitante.
 *
 * `preview` **no** está en la lista por el mismo motivo: `bingpreview` y
 * `facebookexternalhit` ya van explícitos, y un `/preview/` genérico acabaría
 * comiéndose cualquier user-agent de navegador en pruebas.
 */
const BOTS =
  /^whatsapp|bot\b|crawl|spider|slurp|bingpreview|headless|lighthouse|facebookexternalhit|telegrambot|curl\/|wget\/|python-requests|axios\/|node-fetch|go-http-client|monitor/i;

/** Tope por IP. Una visita manda uno o dos beacons; esto solo corta el abuso. */
const LIMITE = 120;
const VENTANA_MS = 60_000;

const COOKIE = "lv_anon";

/** El hash del visitante: cookie + negocio + día. Ver el comentario de arriba. */
function visitanteDe(cookie: string, negocioId: string, fecha: string): string {
  return createHash("sha256")
    .update(`${cookie}:${negocioId}:${fecha}`)
    .digest("hex")
    .slice(0, 32);
}

export async function POST(req: NextRequest) {
  const limitado = rateLimit(req, LIMITE, VENTANA_MS);
  if (!limitado.ok) return new NextResponse(null, { status: 429 });

  const agente = req.headers.get("user-agent") ?? "";
  if (!agente || BOTS.test(agente)) return new NextResponse(null, { status: 204 });

  let cuerpo: unknown;
  try {
    /* El beacon manda un Blob con `application/json`; se lee como texto y se
       parsea a mano para no depender de cómo negocie el cuerpo cada runtime. */
    cuerpo = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const lista = (cuerpo as { eventos?: unknown })?.eventos;
  const limpios = (Array.isArray(lista) ? lista : [])
    .slice(0, MAX_EVENTOS)
    .map(parsearEvento)
    .filter((e) => e !== null);

  if (limpios.length === 0) return new NextResponse(null, { status: 400 });

  const user = await getAppUser().catch(() => null);

  /* Sin cookie —un `curl`, un visitante con las cookies bloqueadas— se inventa
     una al vuelo: el evento se cuenta igual, solo que no sirve para deduplicar.
     Molesta menos que descartar la visita. */
  const cookie = req.cookies.get(COOKIE)?.value ?? randomBytes(16).toString("hex");
  const fecha = diaUtc();

  const resueltos: EventoResuelto[] = [];
  for (const evento of limpios) {
    if (user) {
      const propio =
        evento.negocioId === DEV_PLACE_ID
          ? ownsDevPlace(user.email)
          : await esDueno(user.id, evento.negocioId);
      if (propio) continue;
    }
    resueltos.push({
      ...evento,
      fecha,
      visitante: visitanteDe(cookie, evento.negocioId, fecha),
    });
  }

  if (resueltos.length > 0) await registrarEventos(resueltos);

  /* 204 y sin cuerpo: el cliente no espera nada, es fuego y olvido. */
  return new NextResponse(null, { status: 204 });
}
