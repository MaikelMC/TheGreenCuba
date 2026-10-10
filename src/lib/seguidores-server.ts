import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { avisosSeguidores, places, seguidores } from "@/lib/db/schema";
import { puede } from "@/lib/plans-server";
import type { Plan } from "@/lib/plans";
import { enlacePerfilDe } from "@/lib/publicaciones-server";
import {
  AVISOS_POR_SEMANA,
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
  plan: Plan,
): string | null {
  return enlaceSeguidores(botUsuario(), negocioId, plan);
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

/** Cuántos siguen al negocio ahora mismo. Es el número que ve el dueño. */
export async function contarSeguidores(negocioId: string): Promise<number> {
  const [fila] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(seguidores)
    .where(
      and(eq(seguidores.negocioId, negocioId), isNull(seguidores.bajaEn)),
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
 * Avisa a los seguidores de un negocio. **Máximo tres por semana.**
 *
 * El orden de las comprobaciones es el que explica mejor lo que pasa: primero se
 * valida el aviso, después el plan, después el bot, después el tope y por último
 * si hay alguien al otro lado. Así el dueño recibe la frase que corresponde a su
 * caso —«esto es de Pro» antes de «ya mandaste tres», que es más útil—.
 *
 * **Sin seguidores no se gasta cuota.** Un aviso que no se entregó a nadie no es
 * un aviso: contarlo dejaría a un negocio recién llegado sin sus tres avisos de
 * la semana por haberlos lanzado al vacío. La fila del registro se escribe solo
 * cuando hubo al menos un intento de entrega.
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

  const semana = semanaDelAviso();
  const usados = await avisosDeLaSemana(negocioId, semana);
  if (usados >= AVISOS_POR_SEMANA) {
    return {
      ok: false,
      error: `Ya mandaste ${AVISOS_POR_SEMANA} avisos esta semana. El lunes vuelves a tener los tres.`,
      status: 429,
    };
  }

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

/**
 * Avisa de varios cambios de una vez, parando cuando se agota el tope.
 *
 * La llama el `PATCH` del negocio, que puede traer dos o tres cambios en el
 * mismo guardado —una oferta nueva y un producto nuevo, por ejemplo—. Se avisa
 * de cada uno y se **para al primer «no»**: si el tope semanal ha cortado el
 * segundo, el tercero tampoco va a caber y seguir intentándolo solo escribiría
 * tres líneas de error en el log.
 *
 * Nunca lanza: lo que pasa aquí no puede tumbar el guardado que lo originó.
 */
export async function avisarCambios(
  negocioId: string,
  cambios: { titulo: string; texto: string }[],
): Promise<void> {
  for (const cambio of cambios) {
    try {
      const resultado = await avisarSeguidores(
        negocioId,
        cambio.titulo,
        cambio.texto,
      );
      if (!resultado.ok) {
        console.error("[seguidores] aviso no enviado:", resultado.error);
        return;
      }
    } catch (error) {
      console.error(
        "[seguidores] falló el aviso:",
        error instanceof Error ? error.message : error,
      );
      return;
    }
  }
}
