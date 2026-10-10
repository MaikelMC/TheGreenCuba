import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { places } from "@/lib/db/schema";
import { puede } from "@/lib/plans-server";
import { esBaja, negocioDeStart } from "@/lib/seguidores";
import {
  darDeBaja,
  registrarSeguidor,
  responderTelegram,
} from "@/lib/seguidores-server";

/**
 * El webhook del bot: por aquí entra **todo** lo que la gente le escribe.
 *
 * Es la otra mitad del botón «Avísame de ofertas». El enlace de la ficha abre la
 * conversación con `?start=seg_<negocioId>`; cuando la persona pulsa «Iniciar»,
 * Telegram manda un `/start seg_<negocioId>` a esta ruta y aquí nace la fila con
 * su `consentimiento_en`. **Ese gesto es el consentimiento**: hasta que no pulsa
 * Iniciar no hay nada guardado, y por eso el botón de la ficha no escribe nada
 * por su cuenta.
 *
 * Dos comandos y nada más:
 *
 * - `/start seg_<negocioId>` → alta (o reactivación, si se había dado de baja).
 * - `/baja` (y `/stop`, `/parar`) → baja de todo lo que ese chat seguía.
 *
 * **Autenticación por cabecera secreta.** Telegram firma cada petición con
 * `X-Telegram-Bot-Api-Secret-Token`, el mismo valor que se le pasa al registrar
 * el webhook. Sin `TELEGRAM_WEBHOOK_SECRET` configurado la ruta responde 503 en
 * vez de escuchar: abierta, cualquiera podría suscribir chats ajenos —o dar de
 * baja a todo el mundo— con un `curl`.
 *
 * Siempre se contesta **200 con cuerpo**, incluso cuando el mensaje no nos
 * interesa: un error hace que Telegram reintente el mismo update una y otra vez,
 * y un mensaje que no supimos leer no mejora repitiéndolo.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Lo que se lee de un update. No se declara el tipo entero de la API —tiene
 * cincuenta campos y solo se usan tres—, sino la forma mínima que se necesita,
 * toda opcional: un update puede ser un mensaje, una edición o cualquier otra
 * cosa, y lo que no encaja simplemente no se atiende.
 */
interface UpdateTelegram {
  message?: {
    chat?: { id?: number | string };
    text?: string;
  };
}

/** El chat al que hay que contestar, como texto. `null` = update sin mensaje. */
function chatDe(update: UpdateTelegram): string | null {
  const id = update.message?.chat?.id;
  if (id === undefined || id === null || id === "") return null;
  return String(id);
}

export async function POST(req: NextRequest) {
  const secreto = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secreto) {
    /* Sin secreto no se puede distinguir a Telegram de cualquiera. 503 y no 401:
       no es que esta petición esté mal, es que la ruta no está configurada. */
    return NextResponse.json(
      { ok: false, error: "El webhook no está configurado." },
      { status: 503 },
    );
  }
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secreto) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: UpdateTelegram;
  try {
    update = (await req.json()) as UpdateTelegram;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const chat = chatDe(update);
  const texto = update.message?.text?.trim() ?? "";
  if (!chat || !texto) return NextResponse.json({ ok: true });

  /* `/start seg_<id>`: el alta. El segundo token es el payload del deep link.
     El comando se compara entero —y sin la mención al bot, que Telegram añade en
     los grupos—: un `/startx` no es un `/start`. */
  const [comando, payload] = texto.split(/\s+/);
  if (comando?.toLowerCase().split("@")[0] === "/start") {
    await atenderStart(chat, payload);
    return NextResponse.json({ ok: true });
  }

  if (esBaja(texto)) {
    const dadas = await darDeBaja(chat);
    await responderTelegram(
      chat,
      dadas > 0
        ? "Listo, no te avisamos más. Si cambias de idea, toca «Avísame de ofertas» en la ficha del negocio y vuelve a empezar."
        : "No estabas suscrito a ningún aviso, así que no hay nada que dar de baja.",
    );
    return NextResponse.json({ ok: true });
  }

  /* Cualquier otra cosa: se contesta qué hace este bot. Sin esto, quien escriba
     «hola» se queda pensando que el bot está roto. */
  await responderTelegram(
    chat,
    "Este bot manda los avisos de un negocio de La Verde. Abre «Avísame de ofertas» en la ficha del negocio que te interese para suscribirte, y contesta /baja cuando quieras dejarlo.",
  );
  return NextResponse.json({ ok: true });
}

/**
 * El alta a partir del payload del `/start`.
 *
 * Se vuelve a comprobar el negocio y su plan **aquí** y no se da por hecho: el
 * enlace puede ser viejo —de cuando el negocio pagaba Pro— o inventado, y lo que
 * entra por este webhook no viene de la app. Sin esta comprobación, cualquiera
 * podría suscribir su chat a un negocio que ya no tiene la función.
 */
async function atenderStart(chat: string, payload?: string): Promise<void> {
  const negocioId = negocioDeStart(payload);
  if (!negocioId) {
    await responderTelegram(
      chat,
      "Para suscribirte a los avisos de un negocio, ábrelos desde el botón «Avísame de ofertas» de su ficha en La Verde.",
    );
    return;
  }

  const [place] = await db
    .select({ name: places.name, isActive: places.isActive })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);

  if (!place || !place.isActive || !(await puede(negocioId, "seguidores"))) {
    await responderTelegram(
      chat,
      "Ese negocio ya no tiene los avisos activados, así que no hay nada que seguir. Prueba desde su ficha en La Verde.",
    );
    return;
  }

  await registrarSeguidor({ negocioId, destino: chat });
  await responderTelegram(
    chat,
    `Listo. Te avisaremos cuando ${place.name} publique una oferta o algo nuevo. Contesta /baja cuando no quieras recibir más.`,
  );
}
