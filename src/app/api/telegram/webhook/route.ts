import { NextRequest, NextResponse, after } from "next/server";
import { procesarUpdate } from "@/lib/asistente-server";

/**
 * El webhook del bot de Telegram. Una sola puerta para todo lo que llega:
 * los seguidores (`/start seg_…`, `/baja`) y el asistente del dueño.
 *
 * La ruta es **una cáscara a propósito**. Lo único que hace aquí es lo que no se
 * puede hacer después de contestar:
 *
 * 1. **Verificar el secreto.** Telegram manda `X-Telegram-Bot-Api-Secret-Token`
 *    con el valor que se registró al dar de alta el webhook. Sin él, cualquiera
 *    que sepa la URL podría escribirle al bot en nombre de un dueño. Si no
 *    coincide, 401 y no se toca nada más.
 * 2. **Leer el cuerpo.** El `Request` deja de ser válido en cuanto se responde,
 *    así que el JSON se lee antes y se le pasa al trabajo ya parseado.
 * 3. **Contestar 200.** Telegram reintenta el mismo update hasta recibir un 200,
 *    así que tardar aquí es multiplicar el trabajo. El 200 sale de inmediato y lo
 *    demás va con `after()`.
 *
 * `after()` es de Next y no del proveedor de hosting: en Vercel y en un servidor
 * propio se comporta igual. Nada de lo que hay debajo sabe dónde corre.
 *
 * La idempotencia no se comprueba aquí sino en `procesarUpdate`, contra la tabla
 * `telegram_updates`: entre el 200 y el trabajo hay una ventana real en la que
 * el mismo mensaje llega dos veces.
 */
export const dynamic = "force-dynamic";

/** Segundos. Solo cuenta el trabajo de `after()`; contestar es instantáneo. */
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secreto) {
    /* Sin secreto no hay forma de distinguir a Telegram de cualquiera. Se
       contesta 503 —«mal configurado»— y no 200: un 200 aquí le diría a Telegram
       que todo fue bien y el bot parecería vivo sin estarlo. */
    return NextResponse.json({ ok: false, error: "Webhook no configurado" }, { status: 503 });
  }

  if (req.headers.get("x-telegram-bot-api-secret-token") !== secreto) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    /* Cuerpo ilegible: se contesta 200 igual. Un 4xx haría que Telegram
       reintentase un mensaje que nunca vamos a poder leer. */
    return NextResponse.json({ ok: true });
  }

  after(async () => {
    await procesarUpdate(update);
  });

  return NextResponse.json({ ok: true });
}
