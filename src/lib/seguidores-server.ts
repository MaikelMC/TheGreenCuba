import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { avisosSeguidores, places, seguidores } from "@/lib/db/schema";
import { puede, tieneFuncion } from "@/lib/plans-server";
import { enlacePerfilDe } from "@/lib/publicaciones-server";
import {
  agruparCambios,
  ESPERA_ENTRE_AVISOS_MS,
  enlaceSeguidores,
  lotes,
  mensajeAviso,
  PAUSA_LOTE_MS,
  semanaDelAviso,
  TAMANO_LOTE,
  validarAviso,
  type CanalSeguidor,
} from "@/lib/seguidores";
import { siteConfig } from "@/config/site";
import { generateId } from "@/lib/utils";

/**
 * Los seguidores y los avisos, del lado del servidor.
 *
 * Aquí está lo que **no** puede estar en el cliente: el token del bot, el tope
 * semanal y el envío. Las reglas puras —el enlace, el mensaje, el reparto en
 * lotes— viven en `seguidores.ts`, y esto solo las aplica.
 *
 * Todo lo de este archivo es **best-effort**: un aviso que no sale no puede
 * tumbar el gesto que lo disparó —guardar una oferta, publicar un producto—,
 * porque el dueño estaba haciendo otra cosa. Lo que falla se cuenta
 * (`fallidos`) y se registra en el log.
 */

/** El nombre del bot, sin `@`. Vive en `siteConfig` porque el enlace es
    público y el navegador lo necesita; sin bot no hay nada que ofrecer. */
export function botUsuario(): string {
  return siteConfig.telegramBot;
}

/** El token del bot. Sin esto no se puede enviar nada. */
function tokenTelegram(): string {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

/**
 * El enlace al bot para un negocio, o `null`.
 *
 * Es lo que se guarda en la ficha (`enlaceSeguidores`) y por eso devuelve `null`
 * en vez de una cadena a medias: sin bot configurado no hay botón, y el dueño ve
 * la tarjeta del panel como «no disponible» en lugar de un enlace roto.
 */
export function enlaceSeguidoresDe(
  negocioId: string,
  tieneSeguidores: boolean,
): string | null {
  return enlaceSeguidores(botUsuario(), negocioId, tieneSeguidores);
}

/** Los seguidores vivos de un negocio, por canal. */
export async function seguidoresActivos(
  negocioId: string,
  canal: CanalSeguidor = "telegram",
): Promise<string[]> {
  const filas = await db
    .select({ destino: seguidores.destino })
    .from(seguidores)
    .where(
      and(
        eq(seguidores.negocioId, negocioId),
        eq(seguidores.canal, canal),
        isNull(seguidores.bajaEn),
      ),
    );
  return filas.map((f) => f.destino);
}

/**
 * Cuántos siguen al negocio ahora mismo. Es el número que ve el dueño.
 *
 * Filtra por canal, igual que `seguidoresActivos`: el número del panel tiene
 * que ser el de la gente a la que de verdad le llegan los avisos. Hoy solo hay
 * Telegram, pero contar todos los canales dejaría de coincidir el día que haya
 * otro.
 */
export async function contarSeguidores(
  negocioId: string,
  canal: CanalSeguidor = "telegram",
): Promise<number> {
  const [fila] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(seguidores)
    .where(
      and(
        eq(seguidores.negocioId, negocioId),
        eq(seguidores.canal, canal),
        isNull(seguidores.bajaEn),
      ),
    );
  return fila?.total ?? 0;
}

/** Cuántos avisos lleva esta semana. Es el numerador del tope. */
export async function avisosDeLaSemana(
  negocioId: string,
  semana: string = semanaDelAviso(),
): Promise<number> {
  const [fila] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(avisosSeguidores)
    .where(
      and(
        eq(avisosSeguidores.negocioId, negocioId),
        eq(avisosSeguidores.semana, semana),
      ),
    );
  return fila?.total ?? 0;
}

/**
 * Da de alta a un seguidor (o lo reactiva).
 *
 * El `upsert` va contra el `unique` de (negocio, canal, destino) y es lo que
 * hace que el gesto sea idempotente: pulsar «Iniciar» dos veces no duplica a
 * nadie. Al volver después de una baja se **reescribe** `consentimientoEn` —el
 * consentimiento que vale es el de ahora— y se vacía `bajaEn`.
 */
export async function registrarSeguidor(entrada: {
  negocioId: string;
  destino: string;
  canal?: CanalSeguidor;
}): Promise<void> {
  const canal: CanalSeguidor = entrada.canal ?? "telegram";
  const ahora = new Date();

  await db
    .insert(seguidores)
    .values({
      id: generateId(),
      negocioId: entrada.negocioId,
      canal,
      destino: entrada.destino,
      consentimientoEn: ahora,
    })
    .onConflictDoUpdate({
      target: [seguidores.negocioId, seguidores.canal, seguidores.destino],
      set: { consentimientoEn: ahora, bajaEn: null, updatedAt: ahora },
    });
}

/**
 * La baja: apaga todas las suscripciones de ese chat. Devuelve cuántas había.
 *
 * No sabe de negocios a propósito —quien escribe `/baja` en el chat del bot no
 * está diciendo «deja de avisarme de este negocio», está diciendo «no me
 * escribas más»—, así que esto apaga todo lo que ese destino seguía y el
 * contador que devuelve es lo que permite contestar «no estabas suscrito» a
 * quien no lo estaba.
 */
export async function darDeBaja(
  destino: string,
  canal: CanalSeguidor = "telegram",
): Promise<number> {
  const filas = await db
    .update(seguidores)
    .set({ bajaEn: new Date() })
    .where(
      and(
        eq(seguidores.canal, canal),
        eq(seguidores.destino, destino),
        isNull(seguidores.bajaEn),
      ),
    )
    .returning({ id: seguidores.id });
  return filas.length;
}

/** El resultado de un envío. `definitivo` = el chat no vale y se da de baja. */
type EnvioTelegram =
  | { ok: true }
  | { ok: false; definitivo: boolean; error: string };

/**
 * Un mensaje por la API del bot.
 *
 * `definitivo` distingue «este chat ya no existe» —403 bot bloqueado, 400 chat
 * not found— de «ahora mismo no» —429 o un 5xx—. Solo lo definitivo da de baja
 * al seguidor: tratar un corte de red como una baja borraría seguidores que no
 * se han ido, que es el error caro de los dos.
 *
 * Se manda **sin `parse_mode`**: así nada de lo que escriba el dueño puede
 * romper el mensaje, y el enlace de la ficha lo convierte Telegram solo.
 */
async function enviarTelegram(
  token: string,
  destino: string,
  texto: string,
): Promise<EnvioTelegram> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: destino,
        text: texto,
        /* Sin vista previa del enlace: el mensaje ya lleva la url escrita y una
           tarjeta grande delante tapa el texto, que es lo que importa. */
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) return { ok: true };

    const cuerpo = await res.text().catch(() => "");
    const definitivo = res.status === 400 || res.status === 403;
    return {
      ok: false,
      definitivo,
      error: `Telegram ${res.status}: ${cuerpo.slice(0, 200)}`,
    };
  } catch (error) {
    /* Sin red, con timeout o con el DNS caído: no es una baja, es un fallo. */
    return {
      ok: false,
      definitivo: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Contesta en el chat, sin más ceremonia. Best-effort: si el bot no está
 * configurado o el envío falla, quien escribió no se queda esperando nada.
 *
 * Lo usa el webhook para saludar y para confirmar la baja, que son mensajes
 * que no cuentan para el tope semanal —no son avisos del negocio, son el bot
 * hablando de sí mismo—.
 */
export async function responderTelegram(
  destino: string,
  texto: string,
): Promise<void> {
  const token = tokenTelegram();
  if (!token) return;
  const envio = await enviarTelegram(token, destino, texto);
  if (!envio.ok) console.error("[seguidores] no se pudo contestar:", envio.error);
}

export type ResultadoAviso =
  | {
      ok: true;
      enviados: number;
      fallidos: number;
      /** `sin_seguidores` = nadie a quien avisar; no gasta cuota. */
      motivo?: "sin_seguidores";
    }
  | { ok: false; error: string; status: number };

/**
 * Avisa a los seguidores de un negocio. Sin tope semanal: el ritmo lo pone
 * `avisarCambios`, que junta los avisos que llegan seguidos.
 *
 * El orden de las comprobaciones es el que explica mejor lo que pasa: primero se
 * valida el aviso, después el plan, después el bot y por último si hay alguien
 * al otro lado.
 *
 * **Sin seguidores no se registra nada.** Un aviso que no se entregó a nadie no
 * es un aviso: registrarlo pondría en marcha la espera entre avisos sin que
 * nadie hubiera recibido nada. La fila se escribe solo cuando hubo al menos un
 * intento de entrega.
 *
 * Los rebotes definitivos dan de baja al seguidor en la misma pasada, que es lo
 * que evita volver a intentarlo cada semana con un chat que ya no existe.
 */
export async function avisarSeguidores(
  negocioId: string,
  titulo: string,
  texto: string,
): Promise<ResultadoAviso> {
  const fallo = validarAviso(titulo, texto);
  if (fallo) return { ok: false, error: fallo, status: 400 };

  if (!(await puede(negocioId, "seguidores"))) {
    return {
      ok: false,
      error: "Los avisos a seguidores están disponibles en el plan Pro.",
      status: 403,
    };
  }

  const token = tokenTelegram();
  if (!token) {
    return {
      ok: false,
      error: "El bot de avisos no está configurado.",
      status: 503,
    };
  }

  const [place] = await db
    .select({ name: places.name })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);
  if (!place) {
    return { ok: false, error: "Negocio no encontrado", status: 404 };
  }

  /* Sin tope semanal: el ritmo lo marca la espera entre avisos de
     `avisarCambios`, que junta lo que llega seguido en un solo mensaje. */
  const semana = semanaDelAviso();

  const destinatarios = await seguidoresActivos(negocioId);
  if (destinatarios.length === 0) {
    return { ok: true, enviados: 0, fallidos: 0, motivo: "sin_seguidores" };
  }

  const mensaje = mensajeAviso({
    negocio: place.name,
    titulo,
    texto,
    url: enlacePerfilDe(negocioId),
  });

  let enviados = 0;
  let fallidos = 0;
  const bajas: string[] = [];

  const tandas = lotes(destinatarios, TAMANO_LOTE);
  for (const [i, tanda] of tandas.entries()) {
    const resultados = await Promise.all(
      tanda.map(async (destino) => ({
        destino,
        envio: await enviarTelegram(token, destino, mensaje),
      })),
    );

    for (const { destino, envio } of resultados) {
      if (envio.ok) {
        enviados += 1;
        continue;
      }
      fallidos += 1;
      if (envio.definitivo) bajas.push(destino);
      console.error("[seguidores] no se pudo avisar:", envio.error);
    }

    /* La pausa va **entre** tandas y no después de la última: esperar un segundo
       para terminar deja la respuesta un segundo más lenta sin ganar nada. */
    if (i < tandas.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, PAUSA_LOTE_MS));
    }
  }

  if (bajas.length > 0) {
    await db
      .update(seguidores)
      .set({ bajaEn: new Date() })
      .where(
        and(
          eq(seguidores.negocioId, negocioId),
          eq(seguidores.canal, "telegram"),
          inArray(seguidores.destino, bajas),
        ),
      );
  }

  /* La fila se escribe con el envío ya hecho: es el contador del tope y la
     prueba de a cuántos llegó, y las dos cosas solo se saben al final. */
  await db.insert(avisosSeguidores).values({
    id: generateId(),
    negocioId,
    semana,
    titulo: titulo.trim(),
    enviados,
    fallidos,
  });

  return { ok: true, enviados, fallidos };
}

/** Cuándo salió el último aviso del negocio, o `null` si nunca. */
async function ultimoAvisoEn(negocioId: string): Promise<number | null> {
  const [fila] = await db
    .select({ en: avisosSeguidores.createdAt })
    .from(avisosSeguidores)
    .where(eq(avisosSeguidores.negocioId, negocioId))
    .orderBy(desc(avisosSeguidores.createdAt))
    .limit(1);
  return fila?.en ? fila.en.getTime() : null;
}

/**
 * Los cambios que esperan a que pase la ventana, por negocio.
 *
 * ponytail: en memoria del proceso. Vale porque el VPS corre un solo
 * `node server.js` que no se duerme; un reinicio o un despliegue dentro de la
 * ventana pierde lo pendiente (como mucho media hora de avisos de un negocio).
 * Si algún día hay varias instancias o serverless, pasar esto a una tabla y
 * vaciarla desde el cron del VPS.
 */
const pendientes = new Map<
  string,
  { cambios: { titulo: string; texto: string }[]; temporizador: NodeJS.Timeout }
>();

/** Manda lo acumulado de un negocio como un solo aviso. Nunca lanza. */
async function enviarJuntos(
  negocioId: string,
  cambios: { titulo: string; texto: string }[],
): Promise<void> {
  const aviso = agruparCambios(cambios);
  if (!aviso) return;
  try {
    const resultado = await avisarSeguidores(negocioId, aviso.titulo, aviso.texto);
    if (!resultado.ok) {
      console.error("[seguidores] aviso no enviado:", resultado.error);
    }
  } catch (error) {
    console.error(
      "[seguidores] falló el aviso:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Avisa de los cambios de un guardado, sin tope semanal pero con ritmo.
 *
 * La llama el `PATCH` del negocio. Todos los cambios del mismo guardado van en
 * **un** mensaje. Si el último aviso salió hace menos de
 * `ESPERA_ENTRE_AVISOS_MS`, no se manda nada aún: los cambios se juntan con lo
 * que llegue después y salen en un solo mensaje al cumplirse la espera. Así un
 * negocio que añade veinte productos seguidos manda uno o dos mensajes, no
 * veinte.
 *
 * Nunca lanza: lo que pasa aquí no puede tumbar el guardado que lo originó.
 */
export async function avisarCambios(
  negocioId: string,
  cambios: { titulo: string; texto: string }[],
): Promise<void> {
  if (cambios.length === 0) return;

  /* Ya hay una tanda esperando: se suma a ella. */
  const enCola = pendientes.get(negocioId);
  if (enCola) {
    enCola.cambios.push(...cambios);
    return;
  }

  let ultimo: number | null = null;
  try {
    ultimo = await ultimoAvisoEn(negocioId);
  } catch (error) {
    console.error(
      "[seguidores] no se pudo leer el último aviso:",
      error instanceof Error ? error.message : error,
    );
  }

  const falta = ultimo === null ? 0 : ultimo + ESPERA_ENTRE_AVISOS_MS - Date.now();
  if (falta <= 0) {
    await enviarJuntos(negocioId, cambios);
    return;
  }

  const temporizador = setTimeout(() => {
    const tanda = pendientes.get(negocioId);
    pendientes.delete(negocioId);
    if (tanda) void enviarJuntos(negocioId, tanda.cambios);
  }, falta);
  /* No retiene el proceso abierto solo por esto. */
  temporizador.unref?.();
  pendientes.set(negocioId, { cambios: [...cambios], temporizador });
}
