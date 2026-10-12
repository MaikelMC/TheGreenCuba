import { and, eq, gte, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { chatJSON } from "@/lib/ai";
import { resolveBotProviders } from "@/lib/ai/providers-store";
import { db } from "@/lib/db";
import { CATALOG_TAG, placeStats } from "@/lib/db/queries";
import {
  asistenteCodigos,
  asistenteLog,
  placeMetrics,
  places,
  telegramUpdates,
  telegramVinculos,
} from "@/lib/db/schema";
import { hastaManana, type Disponibilidad } from "@/lib/disponibilidad";
import { setDisponibilidad } from "@/lib/disponibilidad-server";
import { puede } from "@/lib/plans-server";
import { rateLimitKey } from "@/lib/rate-limit";
import {
  registrarSeguidor,
  responderTelegram,
  darDeBaja,
} from "@/lib/seguidores-server";
import { negocioDeStart } from "@/lib/seguidores";
import { generateId } from "@/lib/utils";
import * as A from "@/lib/asistente";

/**
 * El asistente de Telegram, del lado del servidor: lo que habla con la base, con
 * la Bot API y —solo cuando hace falta— con el modelo.
 *
 * Las reglas puras viven en `asistente.ts`; aquí solo se aplican. La ruta del
 * webhook es una cáscara de veinte líneas: verifica el secreto, lee el cuerpo,
 * contesta 200 y encola esto con `after()`. **Todo el trabajo pasa por aquí**,
 * así que no hay dos sitios que decidan cosas distintas.
 *
 * Tres reglas gobiernan el archivo:
 *
 * 1. **El negocio sale del vínculo del chat.** Nunca del texto, nunca de lo que
 *    conteste el modelo. El modelo propone un *nombre* de producto; quién es el
 *    dueño lo dice `telegram_vinculos` y nada más.
 * 2. **Lo barato primero.** Comandos y botones (coste cero), después regex
 *    (coste cero), y solo si nada de eso resuelve se llama al modelo. La mayoría
 *    de los mensajes —«se acabó el pan»— mueren en la capa 2.
 * 3. **Nada de lo que llegue de fuera se cree.** Ni nombres de producto, ni
 *    precios, ni el `hasta` de la IA: todo se valida contra la carta real del
 *    negocio antes de escribir.
 */

/* ── Bot API de Telegram ──────────────────────────────────────────────────
   Sin librería: son cinco llamadas y todas son un POST con JSON. La única cosa
   que no se puede olvidar es el tope de tiempo —un `fetch` colgado deja al dueño
   mirando un mensaje que nunca llega— y el `catch`, porque esto es
   best-effort: si Telegram no contesta, el daño es un mensaje que falta, no una
   excepción que suba por el webhook. */

const TG_TIMEOUT_MS = 8000;

function tokenTelegram(): string {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

async function apiTelegram(
  metodo: string,
  cuerpo: Record<string, unknown>,
): Promise<unknown> {
  const token = tokenTelegram();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TG_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.error(
        `[asistente] Telegram ${metodo} ${res.status}: ${detalle.slice(0, 200)}`,
      );
      return null;
    }
    return await res.json().catch(() => null);
  } catch (error) {
    console.error(
      `[asistente] Telegram ${metodo} no llegó:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** Una fila de botones. Telegram corta a 64 bytes el `callback_data`, así que los
 * identificadores que van ahí son cortos a propósito (`d:agotado:3`, `u:<id>`). */
type Boton = { text: string; callback_data: string };

/** Texto plano, sin `parse_mode`. Lo que se manda lleva nombres de producto que
 * escribe el dueño: con HTML activado, un `<` en un nombre rompe el mensaje. */
function enviarTexto(chatId: string, texto: string): Promise<void> {
  return responderTelegram(chatId, texto);
}

async function enviarBotones(
  chatId: string,
  texto: string,
  botones: Boton[][],
): Promise<void> {
  await apiTelegram("sendMessage", {
    chat_id: chatId,
    text: texto,
    reply_markup: { inline_keyboard: botones },
  });
}

async function editarTexto(
  chatId: string,
  mensajeId: number,
  texto: string,
  botones?: Boton[][],
): Promise<void> {
  await apiTelegram("editMessageText", {
    chat_id: chatId,
    message_id: mensajeId,
    text: texto,
    ...(botones ? { reply_markup: { inline_keyboard: botones } } : {}),
  });
}

/** Quita el relojito del botón. Sin esto Telegram deja el «cargando» unos
 * segundos y parece que el bot se ha caído. */
async function responderCallback(
  callbackId: string,
  texto: string,
  alerta = false,
): Promise<void> {
  await apiTelegram("answerCallbackQuery", {
    callback_query_id: callbackId,
    text: texto,
    show_alert: alerta,
  });
}

/* ── el menú de comandos ──────────────────────────────────────────────────
   La lista que Telegram enseña en su botón azul, junto al campo de texto.

   Se registra con la primera actualización que atiende el proceso. No hay un
   paso de despliegue donde hacerlo —el webhook se registra a mano, una vez— y
   colgarlo del arranque deja el botón puesto sin que nadie tenga que acordarse
   de nada. Cuesta una llamada por arranque en frío y la lista es la misma, así
   que repetirlo no rompe nada.

   El pestillo se cierra **después** de que Telegram conteste: si la llamada se
   pierde con la red que hay aquí, el mensaje siguiente lo vuelve a intentar. */

let comandosRegistrados = false;

async function registrarComandos(): Promise<void> {
  if (comandosRegistrados) return;
  const res = await apiTelegram("setMyCommands", {
    commands: A.comandosTelegram(),
  });
  if (res) comandosRegistrados = true;
}

/* ── el negocio del chat ──────────────────────────────────────────────────
   Una sola consulta resuelve el vínculo, el nombre, la carta, el estado y el
   horario. Antes eran dos viajes a Neon por mensaje; el join no cuesta y el
   precio de cada ida y vuelta sí. */

type Menu = typeof places.$inferSelect.menu;
type EstadoNegocio = typeof places.$inferSelect.status;

interface Negocio {
  negocioId: string;
  nombre: string;
  menu: Menu;
  status: EstadoNegocio;
  schedule: string | null;
}

async function cargarNegocio(chatId: string): Promise<Negocio | null> {
  const [fila] = await db
    .select({
      negocioId: telegramVinculos.negocioId,
      nombre: places.name,
      menu: places.menu,
      status: places.status,
      schedule: places.schedule,
    })
    .from(telegramVinculos)
    .innerJoin(places, eq(places.id, telegramVinculos.negocioId))
    .where(eq(telegramVinculos.chatId, chatId))
    .limit(1);

  return fila ?? null;
}

/** Un producto, con el índice que ocupa en la carta.
 *
 * El índice es lo que viaja en los botones —`d:agotado:3`, unos doce bytes frente a
 * los cuarenta y ocho de un UUID— y lo que se vuelve a resolver al pulsar, así que
 * el id no puede quedarse obsoleto entre el mensaje y el toque. `id` es el de la
 * entrada, o su posición cuando la carta se guardó antes de que los productos
 * tuvieran id: `setDisponibilidad` acepta los dos. */
interface Producto {
  indice: number;
  id: string;
  name: string;
}

function productosDe(menu: Menu): Producto[] {
  return (menu ?? []).map((item, indice) => ({
    indice,
    id: item.id ?? String(indice),
    name: item.name,
  }));
}

/** El índice del producto que `buscarProducto` eligió.
 *
 * `buscarProducto` es puro y devuelve `{id, name}` —no conoce la carta—, así que
 * el índice se recupera por el id que él mismo copió de la lista que le dimos.
 * Con carta vacía o sin coincidencia, `-1`. */
function indiceDe(productos: Producto[], id: string | undefined): number {
  if (!id) return -1;
  return productos.findIndex((p) => p.id === id);
}

/** El estado del producto **antes** de tocarlo, que es lo que permite deshacer. */
function estadoPrevio(menu: Menu, indice: number) {
  const item = menu?.[indice];
  return {
    productoId: item?.id ?? String(indice),
    estado: item?.disponibilidad ?? ("disponible" as Disponibilidad),
  };
}

/* ── el registro ──────────────────────────────────────────────────────────
   `asistente_log` es a la vez la memoria del Deshacer, el contador del techo
   diario de IA y la prueba de qué se cambió. Devuelve el id porque el botón
   «Deshacer» lo necesita para apuntar a la fila exacta —deshacer «lo último» a
   secas acabaría revirtiendo el cambio equivocado si llegan dos seguidos—. */

async function registrarLog(entrada: {
  negocioId: string;
  chatId: string;
  mensaje: string | null;
  accion: string;
  antes: unknown;
  despues: unknown;
  via: "comando" | "regex" | "llm";
  tokensIn?: number;
  tokensOut?: number;
  pendiente?: boolean;
}): Promise<string | null> {
  try {
    const id = generateId();
    await db.insert(asistenteLog).values({
      id,
      negocioId: entrada.negocioId,
      chatId: entrada.chatId,
      mensaje: entrada.mensaje,
      accion: entrada.accion,
      antes: (entrada.antes ?? null) as never,
      despues: (entrada.despues ?? null) as never,
      via: entrada.via,
      tokensIn: entrada.tokensIn ?? 0,
      tokensOut: entrada.tokensOut ?? 0,
      pendiente: entrada.pendiente ?? false,
    });
    return id;
  } catch (error) {
    console.error(
      "[asistente] no se pudo registrar en el log:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/* ── escrituras ───────────────────────────────────────────────────────────
   Cada acción devuelve `{antes, despues}` y no un booleano: el `antes` es lo que
   el Deshacer vuelve a escribir, y calcularlo al deshacer sería tarde —para
   entonces el estado ya es el nuevo—. */

interface Resultado {
  ok: boolean;
  accion: string;
  antes: unknown;
  despues: unknown;
  /** Lo que se le cuenta al dueño. En un fallo, el motivo, ya en castellano. */
  texto: string;
}

async function escribirMenu(negocioId: string, menu: Menu): Promise<void> {
  await db.update(places).set({ menu }).where(eq(places.id, negocioId));
  /* La carta pública va cacheada; sin esto el «agotado» tarda en verse. */
  revalidateTag(CATALOG_TAG, "max");
}

async function ejecutarDisponibilidad(
  negocio: Negocio,
  indice: number,
  estado: Disponibilidad,
  hasta: number | null,
): Promise<Resultado> {
  const producto = productosDe(negocio.menu)[indice];
  const antes = estadoPrevio(negocio.menu, indice);
  if (!producto) {
    return {
      ok: false,
      accion: "set_disponibilidad",
      antes,
      despues: antes,
      texto: "Ese producto ya no está en tu carta.",
    };
  }

  /* Quien decide y valida el plan es `setDisponibilidad`, el mismo camino que usa
     el panel. Aquí no se comprueba nada por segunda vez. */
  const res = await setDisponibilidad(
    negocio.negocioId,
    producto.id,
    estado,
    estado === "agotado" ? hasta : null,
  );

  if (!res.success) {
    return {
      ok: false,
      accion: "set_disponibilidad",
      antes,
      despues: antes,
      texto: res.error,
    };
  }

  return {
    ok: true,
    accion: "set_disponibilidad",
    antes: { productoId: producto.id, estado: antes.estado },
    despues: { productoId: producto.id, estado },
    texto:
      estado === "agotado"
        ? `Listo: «${producto.name}» queda agotado para tus clientes.`
        : `Listo: «${producto.name}» vuelve a estar disponible.`,
  };
}

async function ejecutarPrecio(
  negocio: Negocio,
  indice: number,
  precio: string,
): Promise<Resultado> {
  const menu = negocio.menu ?? [];
  const producto = productosDe(menu)[indice];
  const precioAntes = menu[indice]?.price ?? "";
  const antes = {
    productoId: producto?.id ?? String(indice),
    precio: precioAntes,
  };

  if (!producto) {
    return {
      ok: false,
      accion: "set_precio",
      antes,
      despues: antes,
      texto: "Ese producto ya no está en tu carta.",
    };
  }

  const siguiente = menu.map((item, i) =>
    i === indice ? { ...item, price: precio } : item,
  );
  await escribirMenu(negocio.negocioId, siguiente);

  return {
    ok: true,
    accion: "set_precio",
    antes,
    despues: { productoId: producto.id, precio },
    texto: `Listo: «${producto.name}» queda en ${precio}.`,
  };
}

async function ejecutarHorario(
  negocio: Negocio,
  texto: string,
): Promise<Resultado> {
  const horarioAntes = negocio.schedule ?? "";
  await db
    .update(places)
    .set({ schedule: texto })
    .where(eq(places.id, negocio.negocioId));
  revalidateTag(CATALOG_TAG, "max");

  return {
    ok: true,
    accion: "set_horario",
    antes: { schedule: horarioAntes },
    despues: { schedule: texto },
    texto: `Listo: tu horario dice ahora «${texto}».`,
  };
}

/** Abierto o cerrado. Va sobre `places.status`, que es lo que dice el dueño
 * sobre hoy —`isActive` es lo que dice el sistema sobre si la ficha está
 * publicada, y no se toca desde aquí—. */
async function ejecutarAbrirCerrar(
  negocio: Negocio,
  abierto: boolean,
): Promise<Resultado> {
  const status: EstadoNegocio = abierto ? "active" : "closed";
  const antes = { status: negocio.status };
  await db
    .update(places)
    .set({ status })
    .where(eq(places.id, negocio.negocioId));
  revalidateTag(CATALOG_TAG, "max");

  return {
    ok: true,
    accion: "abrir_cerrar_hoy",
    antes,
    despues: { status },
    texto: abierto
      ? "Listo: tu ficha dice que hoy estás abierto."
      : "Listo: tu ficha dice que hoy estás cerrado.",
  };
}

/* ── deshacer ─────────────────────────────────────────────────────────────
   El Deshacer vuelve a escribir el `antes` que quedó guardado, sin volver a
   interpretar nada. `deshechoEn` es lo que evita que un botón viejo revierta un
   cambio posterior: si la fila ya se deshizo, no se toca. */

async function deshacer(logId: string, negocio: Negocio): Promise<string> {
  const [fila] = await db
    .select()
    .from(asistenteLog)
    .where(
      and(
        eq(asistenteLog.id, logId),
        eq(asistenteLog.negocioId, negocio.negocioId),
        sql`${asistenteLog.deshechoEn} is null`,
      ),
    )
    .limit(1);

  if (!fila) return "Ese cambio ya no se puede deshacer.";

  const antes = fila.antes as Record<string, unknown> | null;

  if (fila.accion === "set_disponibilidad" && antes) {
    await setDisponibilidad(
      negocio.negocioId,
      String(antes.productoId),
      antes.estado as Disponibilidad,
      null,
    );
  } else if (fila.accion === "set_precio" && antes) {
    const menu = negocio.menu ?? [];
    const indice = menu.findIndex(
      (item, i) => (item.id ?? String(i)) === String(antes.productoId),
    );
    if (indice !== -1) {
      await escribirMenu(
        negocio.negocioId,
        menu.map((item, i) =>
          i === indice ? { ...item, price: String(antes.precio) } : item,
        ),
      );
    }
  } else if (fila.accion === "set_horario" && antes) {
    await db
      .update(places)
      .set({ schedule: String(antes.schedule ?? "") })
      .where(eq(places.id, negocio.negocioId));
    revalidateTag(CATALOG_TAG, "max");
  } else if (fila.accion === "abrir_cerrar_hoy" && antes) {
    await db
      .update(places)
      .set({ status: antes.status as EstadoNegocio })
      .where(eq(places.id, negocio.negocioId));
    revalidateTag(CATALOG_TAG, "max");
  }

  await db
    .update(asistenteLog)
    .set({ deshechoEn: new Date() })
    .where(eq(asistenteLog.id, logId));

  return "Listo, quedó como estaba.";
}

/* ── estadísticas ───────────────────────────────────────────────────────── */

async function textoStats(negocioId: string): Promise<string> {
  const [stats, fila] = await Promise.all([
    placeStats(negocioId),
    db
      .select({ views: placeMetrics.views })
      .from(placeMetrics)
      .where(eq(placeMetrics.placeId, negocioId))
      .limit(1),
  ]);

  const vistas = fila[0]?.views ?? 0;
  return [
    "Así va tu ficha hoy:",
    `• ${vistas} visitas en total`,
    `• ${stats.saved} veces guardada`,
    `• ${stats.reviews} reseñas`,
    `• ${stats.photos} fotos`,
  ].join("\n");
}

/* ── entradas ─────────────────────────────────────────────────────────────
   Los textos que no dependen de nada. En constantes y no repartidos por las
   funciones para que se puedan corregir de una vez. */

const SIN_VINCULO =
  "Este chat todavía no está unido a ningún negocio. Abre el panel de tu negocio en La Verde, pulsa «Asistente de Telegram» y mándame el código así: /start CODIGO";

const AYUDA = [
  "Puedo hacer esto por ti:",
  "",
  "/carta — te mando tu carta con precios y qué está agotado",
  "/agotado — marcar productos como agotados, con botones",
  "/disponible — volver a ponerlos",
  "/abrir y /cerrar — si hoy atiendes o no",
  "/stats — cómo va tu ficha",
  "",
  "Y si me escribes normal también te entiendo, vendas lo que vendas: «muéstrame la carta», «se acabó el jabón», «pon el servicio a 500». Todo lo que cambie lo puedes deshacer.",
].join("\n");

/** El menú de siempre, pegado a los mensajes donde el dueño no sabe qué hacer.
 *
 * Los botones apuntan a comandos que ya existen —`cmd:carta` es `/carta`— para
 * que no haya dos caminos que hagan lo mismo por separado. */
const MENU: Boton[][] = [
  [
    { text: "Ver mi carta", callback_data: "cmd:carta" },
    { text: "Mis estadísticas", callback_data: "cmd:stats" },
  ],
  [
    { text: "Marcar agotado", callback_data: "cmd:agotado" },
    { text: "Marcar disponible", callback_data: "cmd:disponible" },
  ],
  [
    { text: "Abrir hoy", callback_data: "cmd:abrir" },
    { text: "Cerrar hoy", callback_data: "cmd:cerrar" },
  ],
];

/** Lo que se contesta cuando no se entendió. En una constante y con el menú
 * detrás: el dueño que no se explicó tiene que poder seguir con un toque. */
const NO_ENTENDI =
  "No te entendí. Prueba a decírmelo más corto —«se acabó el jabón», «pon el servicio a 500»— o toca un botón:";

/** Lo que se contesta a un saludo. Lleva el nombre del negocio porque es lo
 * primero que ve quien acaba de vincular el chat, y ahí conviene saber que el
 * bot ya sabe con quién habla. No gasta modelo: un «hola» no pide nada. */
function saludoDe(nombre: string): string {
  return `¡Hola! Soy el asistente de ${nombre}. Dime qué necesitas o toca un botón:`;
}

/* ── el update ──────────────────────────────────────────────────────────── */

/**
 * Atiende un update ya leído de Telegram.
 *
 * La idempotencia va **lo primero**: Telegram reenvía el mismo `update_id`
 * hasta que el webhook contesta 200, y el 200 se manda antes de procesar, así
 * que la ventana en la que el mismo mensaje llega dos veces es real. El
 * `insert … on conflict do nothing` es la valla: si no entró ninguna fila, este
 * update ya se atendió y aquí se acaba.
 *
 * `after()` puede cortar la ejecución en cualquier punto, así que esto se
 * escribe como si nadie fuera a leer el resultado: cada paso deja el estado
 * coherente por sí solo.
 */
export async function procesarUpdate(raw: unknown): Promise<void> {
  const update = A.leerTelegramUpdate(raw as A.RawMessageTelegram);
  if (!update) return;

  if (update.update_id !== undefined) {
    const metido = await db
      .insert(telegramUpdates)
      .values({ updateId: update.update_id })
      .onConflictDoNothing()
      .returning({ updateId: telegramUpdates.updateId });
    if (metido.length === 0) return;

    /* La purga, de vez en cuando y en el mismo camino del alta: pagar un
       `delete` en cada mensaje para borrar filas que caducan solas no sale a
       cuenta. */
    if (Math.random() < 0.02) void purgarAntiguos();
  }

  /* El menú del botón azul, junto al campo de texto. Va aquí y no en un paso de
     despliegue porque no existe tal paso: el webhook se registra a mano. */
  await registrarComandos();

  try {
    if (update.callback_query_id) {
      await manejarCallback(update);
    } else {
      await manejarTexto(update);
    }
  } catch (error) {
    /* Al dueño se le manda una frase; la traza se queda aquí. */
    console.error(
      "[asistente] falló el update:",
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    await enviarTexto(
      update.chat_id,
      "Se me cruzaron los cables con eso. Prueba otra vez en un momento.",
    );
  }
}

/** Fuera los updates de más de 48 h: Telegram reintenta durante un rato corto,
 * así que pasado ese plazo la fila solo ocupa sitio. */
async function purgarAntiguos(): Promise<void> {
  try {
    await db
      .delete(telegramUpdates)
      .where(sql`${telegramUpdates.creado} < now() - interval '48 hours'`);
  } catch (error) {
    console.error(
      "[asistente] no se pudo purgar:",
      error instanceof Error ? error.message : error,
    );
  }
}

/* ── mensajes de texto ──────────────────────────────────────────────────── */

async function manejarTexto(update: A.ParsedTelegram): Promise<void> {
  const texto = update.texto;
  if (!texto) return;

  const parseo = A.parseComando(texto);
  const comando = parseo?.comando;

  /* `/start` y `/baja` no piden vínculo: el primero es justo el que lo crea y el
     segundo tiene que poder ejecutarlo cualquiera que quiera irse. */
  if (comando === "start") {
    await manejarStart(update.chat_id, parseo?.resto ?? "");
    return;
  }
  if (comando === "baja") {
    await manejarBaja(update.chat_id);
    return;
  }

  const negocio = await cargarNegocio(update.chat_id);
  if (!negocio) {
    await enviarTexto(update.chat_id, SIN_VINCULO);
    return;
  }

  if (comando && A.esComandoValido(comando)) {
    /* Los de la lista negra son comandos de otros bots: no se atienden ni se
       mandan al modelo —que cobraría por un «/help»—, solo se desvían. */
    if (A.ignorarComandoExterno(comando)) {
      await enviarTexto(
        update.chat_id,
        "Ese comando no es mío. Escribe /ayuda.",
      );
      return;
    }
    await manejarComando(negocio, update, comando, parseo?.resto ?? "");
    return;
  }

  await manejarTextoLibre(negocio, update);
}

/* ── vinculación ────────────────────────────────────────────────────────── */

async function manejarStart(chatId: string, resto: string): Promise<void> {
  const payload = resto.trim();

  /* `seg_<negocioId>` es el enlace de los seguidores: mismo bot, otra puerta.
     Se reusa la lógica de `seguidores-server`, que ya estaba. */
  const negocioSeguidor = negocioDeStart(payload);
  if (negocioSeguidor) {
    await altaSeguidor(chatId, negocioSeguidor);
    return;
  }

  if (!payload) {
    const negocio = await cargarNegocio(chatId);
    if (negocio) {
      await enviarBotones(
        chatId,
        `Ya estás unido a ${negocio.nombre}.\n\n${AYUDA}`,
        MENU,
      );
    } else {
      await enviarTexto(chatId, SIN_VINCULO);
    }
    return;
  }

  await vincular(chatId, payload);
}

async function altaSeguidor(chatId: string, negocioId: string): Promise<void> {
  const [place] = await db
    .select({ name: places.name, isActive: places.isActive })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);

  if (!place || !place.isActive || !(await puede(negocioId, "seguidores"))) {
    await enviarTexto(chatId, "Ese negocio ya no tiene los avisos activados.");
    return;
  }

  await registrarSeguidor({ negocioId, destino: chatId });
  await enviarTexto(
    chatId,
    `Listo. Te avisaremos cuando ${place.name} publique una oferta o algo nuevo. Contesta /baja cuando no quieras recibir más.`,
  );
}

async function manejarBaja(chatId: string): Promise<void> {
  const cuantas = await darDeBaja(chatId);
  await enviarTexto(
    chatId,
    cuantas > 0
      ? "Hecho: no volverás a recibir avisos. Si cambias de idea, entra otra vez por el enlace del negocio."
      : "No estabas suscrito a ningún negocio, así que no hay nada que dar de baja.",
  );
}

/**
 * Canjea el código del panel y une el chat al negocio.
 *
 * El código **es** la credencial: hay que haber estado dentro del panel de ese
 * negocio para leerlo, caduca a los diez minutos y solo vale una vez. Se marca
 * como usado en la misma transacción que crea el vínculo para que dos chats no
 * puedan gastar el mismo.
 */
async function vincular(chatId: string, codigo: string): Promise<void> {
  const ahora = new Date();

  /* `usado_en is null` y `expira_en > ahora` dentro del `update`: así el canje
     es atómico. Comprobar antes y marcar después deja una rendija por la que el
     mismo código entra dos veces. */
  const [canjeado] = await db
    .update(asistenteCodigos)
    .set({ usadoEn: ahora, usadoPor: chatId })
    .where(
      and(
        eq(asistenteCodigos.codigo, codigo.toUpperCase()),
        sql`${asistenteCodigos.usadoEn} is null`,
        gte(asistenteCodigos.expiraEn, ahora),
      ),
    )
    .returning({ negocioId: asistenteCodigos.negocioId });

  if (!canjeado) {
    await enviarTexto(
      chatId,
      "Ese código no me vale: o ya se usó, o se le pasaron los diez minutos. Genera otro en el panel de tu negocio.",
    );
    return;
  }

  const negocioId = canjeado.negocioId;

  if (!(await puede(negocioId, "asistente_ia"))) {
    await enviarTexto(
      chatId,
      "Ese negocio no tiene el asistente contratado (es del plan Pro). Puedes activarlo desde el panel.",
    );
    return;
  }

  /* `onConflictDoUpdate` sobre el `unique` de `chat_id`: un chat, un negocio. Si
     ese chat ya estaba unido a otro, se reescribe —que es lo que se quiere al
     cambiar de negocio—. */
  await db
    .insert(telegramVinculos)
    .values({ id: generateId(), negocioId, chatId, rol: "dueno" })
    .onConflictDoUpdate({
      target: telegramVinculos.chatId,
      set: { negocioId, rol: "dueno", updatedAt: ahora },
    });

  const [place] = await db
    .select({ name: places.name })
    .from(places)
    .where(eq(places.id, negocioId))
    .limit(1);

  await enviarBotones(
    chatId,
    `Listo, ya soy el asistente de ${place?.name ?? "tu negocio"}.\n\n${AYUDA}`,
    MENU,
  );
}

/* ── capa 1: comandos y botones ─────────────────────────────────────────── */

async function manejarComando(
  negocio: Negocio,
  update: A.ParsedTelegram,
  comando: string,
  resto: string,
): Promise<void> {
  const chatId = update.chat_id;

  switch (comando) {
    case "ayuda":
    case "help":
      await enviarBotones(chatId, AYUDA, MENU);
      return;

    case "stats":
      await enviarTexto(chatId, await textoStats(negocio.negocioId));
      return;

    case "carta":
      await enviarTexto(chatId, A.textoCarta(negocio.menu ?? []));
      return;

    case "abrir":
    case "cerrar": {
      const res = await ejecutarAbrirCerrar(negocio, comando === "abrir");
      const logId = await registrarLog({
        negocioId: negocio.negocioId,
        chatId,
        mensaje: `/${comando}`,
        accion: res.accion,
        antes: res.antes,
        despues: res.despues,
        via: "comando",
      });
      await enviarTexto(chatId, res.texto);
      await ofrecerDeshacer(chatId, logId);
      return;
    }

    case "agotado":
    case "disponible": {
      const estado: Disponibilidad =
        comando === "agotado" ? "agotado" : "disponible";
      await enviarPaginaProductos(negocio, chatId, estado, 0);
      return;
    }

    default:
      /* Comando conocido pero sin rama —`start` ya se atendió antes—. */
      await enviarTexto(chatId, "Ese no lo tengo. Escribe /ayuda.");
  }
}

/** La lista paginada de productos, con un botón por producto.
 *
 * El `callback_data` lleva el **índice** y no el id: siete bytes frente a los
 * treinta y seis de un UUID, y el tope de Telegram son 64. El índice se resuelve
 * otra vez al pulsar, contra la carta que haya entonces. */
async function enviarPaginaProductos(
  negocio: Negocio,
  chatId: string,
  estado: Disponibilidad,
  desde: number,
): Promise<void> {
  const productos = productosDe(negocio.menu);
  if (productos.length === 0) {
    await enviarTexto(
      chatId,
      "Tu carta todavía no tiene productos. Añádelos desde el panel de tu negocio y mándame /carta para verla.",
    );
    return;
  }

  const pagina = productos.slice(desde, desde + A.TAMANO_PAGINA);
  const filas: Boton[][] = pagina.map((p) => [
    {
      text: A.recortarEtiqueta(p.name),
      callback_data: `d:${estado}:${p.indice}`,
    },
  ]);

  /* Los de página van en una fila de dos, y solo aparecen si hay a dónde ir. */
  const navegacion: Boton[] = [];
  if (desde > 0) {
    navegacion.push({
      text: "← Antes",
      callback_data: `p:${estado}:${Math.max(0, desde - A.TAMANO_PAGINA)}`,
    });
  }
  if (desde + A.TAMANO_PAGINA < productos.length) {
    navegacion.push({
      text: "Después →",
      callback_data: `p:${estado}:${desde + A.TAMANO_PAGINA}`,
    });
  }
  if (navegacion.length > 0) filas.push(navegacion);

  const verbo = estado === "agotado" ? "se acabó" : "ya hay";
  await enviarBotones(
    chatId,
    `¿Qué ${verbo}? Toca el producto (${desde + 1}–${desde + pagina.length} de ${productos.length}):`,
    filas,
  );
}

/* ── capa 2: texto libre sin modelo ─────────────────────────────────────── */

async function manejarTextoLibre(
  negocio: Negocio,
  update: A.ParsedTelegram,
): Promise<void> {
  const chatId = update.chat_id;

  /* El tope por chat va aquí y no en el webhook: lo que se limita es el trabajo
     —una carta, un modelo—, no que Telegram reenvíe un update. */
  const cupo = rateLimitKey(
    `tg:${chatId}`,
    A.RATE_CHAT_MAX,
    A.RATE_CHAT_VENTANA_MS,
  );
  if (!cupo.ok) {
    await enviarTexto(
      chatId,
      `Ve más despacio, que me aturullo. Prueba en ${cupo.retryAfterSeconds ?? 60} segundos.`,
    );
    return;
  }

  /* El saludo va antes que todo: es lo más barato que hay y lo primero que
     escribe casi todo el mundo. Sin esto, un «hola» acabaría en el modelo
     —una llamada pagada por un mensaje que no pide nada— y la respuesta de la
     IA a un saludo es cualquiera menos la que el dueño espera. */
  if (A.esSaludo(update.texto)) {
    await enviarBotones(chatId, saludoDe(negocio.nombre), MENU);
    return;
  }

  const intencion = A.intencionDeTexto(update.texto);
  if (intencion) {
    /* «se acabó» a secas: el dueño sabe qué se acabó y no lo escribió. La
       respuesta útil es la lista con botones, y esa ya existe. */
    if (intencion.tipo === "disponibilidad" && !intencion.producto) {
      await enviarPaginaProductos(negocio, chatId, intencion.estado, 0);
      return;
    }

    const productos = productosDe(negocio.menu);
    const busqueda = A.buscarProducto(intencion.producto, productos);

    if (busqueda.nivel === "claro" && busqueda.mejor) {
      /* Un precio siempre pregunta; se deja esperando y se enseña con el nombre
         que hay en la carta, no con el que se escribió. */
      if (intencion.tipo === "precio") {
        await pedirConfirmacionPrecio({
          negocio,
          chatId,
          mensaje: update.texto,
          producto: busqueda.mejor.name,
          precio: intencion.precio,
          via: "regex",
        });
        return;
      }

      const indice = indiceDe(productos, busqueda.mejor.id);
      const res = await ejecutarDisponibilidad(
        negocio,
        indice,
        intencion.estado,
        null,
      );
      const logId = await registrarLog({
        negocioId: negocio.negocioId,
        chatId,
        mensaje: update.texto,
        accion: res.accion,
        antes: res.antes,
        despues: res.despues,
        via: "regex",
      });
      await enviarTexto(chatId, res.texto);
      await ofrecerDeshacer(chatId, logId);
      return;
    }

    if (busqueda.nivel === "ambiguo") {
      await preguntarCual({
        negocio,
        chatId,
        mensaje: update.texto,
        frase: intencion.producto,
        accion:
          intencion.tipo === "precio" ? "set_precio" : "set_disponibilidad",
        propuesta:
          intencion.tipo === "precio"
            ? { producto: intencion.producto, precio: intencion.precio }
            : { producto: intencion.producto, estado: intencion.estado },
        candidatos: busqueda.lista,
        via: "regex",
      });
      return;
    }
    /* `ninguno`: no lo reconozco por texto. Sigue por el modelo. */
  }

  await manejarConModelo(negocio, update);
}

/* ── capa 3: el modelo ──────────────────────────────────────────────────── */

/**
 * El mensaje que no supieron leer ni los comandos ni el regex.
 *
 * Una sola llamada al modelo, y **sin segunda vuelta**: el modelo propone una
 * acción, se ejecuta aquí y la confirmación la escribe este archivo. Pedirle
 * después que redacte la respuesta costaría otra llamada para decir algo que ya
 * sabemos —que el pan quedó agotado—.
 *
 * La cadena de proveedores es la del `.env` —las claves `*_BOT` si están, la
 * general si no—: `chatJSON` trae el failover y el tope por proveedor, así que
 * aquí no hay que elegir modelo ni reintentar.
 */
async function manejarConModelo(
  negocio: Negocio,
  update: A.ParsedTelegram,
): Promise<void> {
  const chatId = update.chat_id;

  const cuota = await cuotaIaDisponible(negocio.negocioId);
  if (!cuota) {
    await enviarBotones(
      chatId,
      "Por hoy ya gastaste las respuestas libres de tu asistente, y se renuevan mañana. Los botones y los comandos siguen funcionando:",
      MENU,
    );
    return;
  }

  const productos = productosDe(negocio.menu);
  const usarCache = A.puedeUsarCache();
  const { system } = A.promptParaLLM(usarCache);

  /* La carta va en el mensaje de usuario, no en el sistema: cambia en cada
     llamada, y como datos —«estos son los productos que existen»—, no como
     instrucciones. */
  const catalogo =
    productos.length > 0
      ? productos.map((p, i) => `${i + 1}. ${p.name}`).join("\n")
      : "(sin productos en la carta)";

  let propuesta: unknown;
  let tokensIn = 0;
  let tokensOut = 0;

  try {
    /* Sin historial: cada mensaje del dueño se entiende solo —«se acabó el pan»
       no necesita el anterior— y arrastrar cuatro turnos costaría tokens en
       todas las llamadas para ayudar en muy pocas. El tope de la spec es un
       máximo, no un mínimo. */
    const respuesta = await chatJSON<Record<string, unknown>>({
      system,
      user: `Productos del negocio:\n${catalogo}\n\nMensaje del dueño:\n"""\n${update.texto}\n"""`,
      maxTokens: A.IA_MAX_TOKENS,
      temperature: 0,
      providers: resolveBotProviders(),
    });
    propuesta = respuesta.data;
    tokensIn = respuesta.tokensIn;
    tokensOut = respuesta.tokensOut;
  } catch (error) {
    console.error(
      "[asistente] el modelo no contestó:",
      error instanceof Error ? error.message : error,
    );
    await enviarBotones(chatId, NO_ENTENDI, MENU);
    return;
  }

  const p = (propuesta ?? {}) as Record<string, unknown>;
  const accion = typeof p.accion === "string" ? p.accion : "";

  if (!A.esAccionValida(accion)) {
    await registrarLog({
      negocioId: negocio.negocioId,
      chatId,
      mensaje: update.texto,
      accion: "ninguna",
      antes: null,
      despues: null,
      via: "llm",
      tokensIn,
      tokensOut,
    });
    await enviarBotones(chatId, NO_ENTENDI, MENU);
    return;
  }

  /* Las dos que solo leen: se resuelven aparte, que no escriben nada y no hay
     confirmación que pedir. */
  if (accion === "consultar_stats" || accion === "ver_carta") {
    const texto =
      accion === "consultar_stats"
        ? await textoStats(negocio.negocioId)
        : A.textoCarta(negocio.menu ?? []);
    await registrarLog({
      negocioId: negocio.negocioId,
      chatId,
      mensaje: update.texto,
      accion,
      antes: null,
      despues: null,
      via: "llm",
      tokensIn,
      tokensOut,
    });
    await enviarTexto(chatId, texto);
    return;
  }

  /* Las acciones que van contra un producto se resuelven aquí una sola vez, y el
     nivel decide el camino.

     Cuando el nombre sonaba a varios, el camino acababa en «no encontré ese
     producto», que es justo lo contrario de lo que hay que hacer: el dueño dijo
     «el café» y en su carta hay tres que empiezan así —el problema es del bot,
     no suyo—. Ahora se pregunta, con botones. */
  if (accion === "set_disponibilidad" || accion === "set_precio") {
    const nombre = typeof p.producto === "string" ? p.producto : "";
    const busqueda = A.buscarProducto(nombre, productos);

    if (busqueda.nivel === "ambiguo") {
      await preguntarCual({
        negocio,
        chatId,
        mensaje: update.texto,
        frase: nombre,
        accion,
        propuesta: p,
        candidatos: busqueda.lista,
        via: "llm",
        tokensIn,
        tokensOut,
      });
      return;
    }

    /* La confirmación va **antes** de escribir, y eso es lo que la hace una
       confirmación: el precio se pregunta sin haberlo tocado. Lo que se guarda
       es el nombre que hay en la carta, así que al pulsar «Sí» se vuelve a pasar
       por `ejecutarAccionModelo` —el único camino que resuelve el producto— y
       acierta solo. */
    if (
      busqueda.nivel === "claro" &&
      busqueda.mejor &&
      A.requiereConfirmacion(1, accion === "set_precio") === "confirmar"
    ) {
      const precio =
        typeof p.precio === "string" ? p.precio.trim().slice(0, 40) : "";
      if (precio) {
        await pedirConfirmacionPrecio({
          negocio,
          chatId,
          mensaje: update.texto,
          producto: busqueda.mejor.name,
          precio,
          via: "llm",
          tokensIn,
          tokensOut,
        });
        return;
      }
      /* Sin precio no hay nada que confirmar: cae al camino de siempre. */
    }
    /* `ninguno`: tampoco se resuelve, y también cae al camino de siempre, que
       contesta que no encontró el producto. */
  }

  /* El negocio del vínculo, nunca el del texto. Y el producto, resuelto contra
     la carta real por parecido: el modelo devuelve un nombre, no un id. */
  const res = await ejecutarAccionModelo(negocio, accion, p);

  if (!res) {
    await enviarBotones(
      chatId,
      "No encontré ese producto en tu carta. Mírala y mándame el nombre tal como aparece ahí:",
      MENU,
    );
    return;
  }

  if (!res.ok) {
    await registrarLog({
      negocioId: negocio.negocioId,
      chatId,
      mensaje: update.texto,
      accion: res.accion,
      antes: res.antes,
      despues: res.despues,
      via: "llm",
      tokensIn,
      tokensOut,
    });
    await enviarTexto(chatId, res.texto);
    return;
  }

  const logId = await registrarLog({
    negocioId: negocio.negocioId,
    chatId,
    mensaje: update.texto,
    accion: res.accion,
    antes: res.antes,
    despues: res.despues,
    via: "llm",
    tokensIn,
    tokensOut,
  });
  await enviarTexto(chatId, res.texto);
  await ofrecerDeshacer(chatId, logId);
}

/** El índice del producto que propuso el modelo, resuelto por parecido contra la
 * carta real y exigiéndole candidato **claro**: si el modelo duda, se pregunta en
 * vez de acertar por suerte con el producto equivocado. `null` = no se resuelve. */
function resolverPropuesta(
  productos: Producto[],
  nombre: unknown,
): number | null {
  if (typeof nombre !== "string" || !nombre.trim()) return null;
  const b = A.buscarProducto(nombre, productos);
  if (b.nivel !== "claro" || !b.mejor) return null;
  const indice = indiceDe(productos, b.mejor.id);
  return indice === -1 ? null : indice;
}

/** Los botones de una confirmación cualquiera. */
function botonesSiNo(logId: string): Boton[][] {
  return [
    [
      { text: "Sí", callback_data: `y:${logId}` },
      { text: "No", callback_data: `n:${logId}` },
    ],
  ];
}

/** Un botón por candidato.
 *
 * Lo que viaja en el `callback_data` es **el índice y el id de la fila** —unos
 * diecisiete bytes— y no el nombre del producto, que no cabe ni de lejos en los
 * 64 de Telegram. El id es lo que devuelve el clic a la propuesta que esperaba:
 * sin él habría que adivinar qué se iba a cambiar. */
function botonesCandidatos(
  candidatos: Array<{ id: string; name: string }>,
  productos: Producto[],
  logId: string,
): Boton[][] {
  return candidatos
    .map((c) => ({ indice: indiceDe(productos, c.id), name: c.name }))
    .filter((c) => c.indice !== -1)
    .slice(0, 6)
    .map((c) => [
      {
        text: A.recortarEtiqueta(c.name),
        callback_data: `c:${logId}:${c.indice}`,
      },
    ]);
}

/**
 * «¿A cuál te refieres?»: deja la propuesta esperando y enseña los candidatos.
 *
 * La fila guarda **lo que se va a aplicar**, no un puntero al mensaje. Al tocar
 * un candidato se re-ejecuta por el mismo camino que si el nombre hubiera estado
 * bien escrito, así que no hay una segunda ruta que aplique cambios.
 *
 * `via` se guarda para que el techo diario de IA cuente lo que de verdad costó:
 * una pregunta nacida del modelo gastó su llamada. */
async function preguntarCual(args: {
  negocio: Negocio;
  chatId: string;
  /** El mensaje del dueño, tal cual: va al registro. */
  mensaje: string;
  /** La frase del producto que no se supo resolver; es la que se repite. */
  frase: string;
  accion: string;
  propuesta: Record<string, unknown>;
  candidatos: Array<{ id: string; name: string }>;
  via: "regex" | "llm";
  tokensIn?: number;
  tokensOut?: number;
}): Promise<void> {
  const productos = productosDe(args.negocio.menu);
  const logId = await registrarLog({
    negocioId: args.negocio.negocioId,
    chatId: args.chatId,
    mensaje: args.mensaje,
    accion: args.accion,
    antes: null,
    despues: args.propuesta,
    via: args.via,
    tokensIn: args.tokensIn,
    tokensOut: args.tokensOut,
    pendiente: true,
  });

  if (!logId) {
    await enviarTexto(
      args.chatId,
      "No pude dejar el cambio preparado. Prueba otra vez.",
    );
    return;
  }

  const filas = botonesCandidatos(args.candidatos, productos, logId);
  if (filas.length === 0) {
    /* Ningún candidato sigue en la carta: no hay nada que preguntar, así que la
       fila sobra y se va. */
    await db.delete(asistenteLog).where(eq(asistenteLog.id, logId));
    await enviarBotones(args.chatId, NO_ENTENDI, MENU);
    return;
  }

  await enviarBotones(args.chatId, A.preguntaCandidatos(args.frase), filas);
}

/** Deja el cambio de precio esperando el «Sí» y lo pregunta.
 *
 * Se guarda el nombre del producto **tal como está en la carta**, no como se
 * escribió: al volver a resolverlo para aplicarlo acierta solo, sin volver a
 * depender del parecido. */
async function pedirConfirmacionPrecio(args: {
  negocio: Negocio;
  chatId: string;
  mensaje: string;
  producto: string;
  precio: string;
  via: "regex" | "llm";
  tokensIn?: number;
  tokensOut?: number;
}): Promise<void> {
  const logId = await registrarLog({
    negocioId: args.negocio.negocioId,
    chatId: args.chatId,
    mensaje: args.mensaje,
    accion: "set_precio",
    antes: null,
    despues: { producto: args.producto, precio: args.precio },
    via: args.via,
    tokensIn: args.tokensIn,
    tokensOut: args.tokensOut,
    pendiente: true,
  });

  if (!logId) {
    await enviarTexto(
      args.chatId,
      "No pude dejar el cambio preparado. Prueba otra vez.",
    );
    return;
  }

  await enviarBotones(
    args.chatId,
    `Cambio «${args.producto}» a ${args.precio}.\n¿Lo aplico?`,
    botonesSiNo(logId),
  );
}

/** Traduce lo que propuso el modelo a una escritura, sin creerse nada.
 *
 * `producto` llega como nombre escrito por el modelo, así que se resuelve por
 * parecido contra la carta y se exige un candidato claro: si el modelo duda, se
 * pregunta en vez de acertar por suerte con el producto equivocado. */
async function ejecutarAccionModelo(
  negocio: Negocio,
  accion: string,
  p: Record<string, unknown>,
): Promise<Resultado | null> {
  const productos = productosDe(negocio.menu);
  const resolver = (nombre: unknown) => resolverPropuesta(productos, nombre);

  switch (accion) {
    case "set_disponibilidad": {
      const indice = resolver(p.producto);
      if (indice === null) return null;
      const estado: Disponibilidad =
        p.estado === "agotado" ? "agotado" : "disponible";
      /* «hasta» es texto libre («mañana», «el lunes»). Lo único que sabemos
         interpretar es «mañana», y solo cuando lo dice; cualquier otra cosa se
         marca sin fecha de vuelta, que es el caso normal. */
      const hasta =
        typeof p.hasta === "string" && /ma[ñn]ana/i.test(p.hasta)
          ? hastaManana()
          : null;
      return ejecutarDisponibilidad(negocio, indice, estado, hasta);
    }

    case "set_precio": {
      const indice = resolver(p.producto);
      if (indice === null) return null;
      /* El precio es texto libre en la carta («3–5 USD»), así que no se convierte
         a número: lo que escriba el modelo se guarda tal cual, recortado. */
      const precio =
        typeof p.precio === "string" ? p.precio.trim().slice(0, 40) : "";
      if (!precio) return null;
      return ejecutarPrecio(negocio, indice, precio);
    }

    case "set_horario": {
      const texto =
        typeof p.texto === "string" ? p.texto.trim().slice(0, 120) : "";
      if (!texto) return null;
      return ejecutarHorario(negocio, texto);
    }

    case "abrir_cerrar_hoy":
      return ejecutarAbrirCerrar(negocio, p.abierto !== false);

    case "consultar_stats":
    case "ver_carta":
      /* Se resuelven fuera, que necesitan otra consulta. */
      return { ok: true, accion, antes: null, despues: null, texto: "" };

    default:
      return null;
  }
}

/** Cuántos mensajes de IA lleva hoy este negocio. Los comandos y los botones no
 * cuentan: solo lo que se paga. */
async function cuotaIaDisponible(negocioId: string): Promise<boolean> {
  try {
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    const [fila] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(asistenteLog)
      .where(
        and(
          eq(asistenteLog.negocioId, negocioId),
          eq(asistenteLog.via, "llm"),
          gte(asistenteLog.ts, inicioDelDia),
        ),
      );

    return (fila?.total ?? 0) < A.IA_MENSAJES_POR_DIA;
  } catch (error) {
    /* Si el contador no se puede leer se deja pasar: dejar al dueño sin
       asistente por un fallo de lectura es peor que gastar unos mensajes de
       más. El tope está para el abuso, no para el accidente. */
    console.error(
      "[asistente] no se pudo contar la cuota de IA:",
      error instanceof Error ? error.message : error,
    );
    return true;
  }
}

/* ── botones ────────────────────────────────────────────────────────────── */

async function manejarCallback(update: A.ParsedTelegram): Promise<void> {
  const data = update.callback_data ?? "";
  const chatId = update.chat_id;
  const callbackId = update.callback_query_id ?? "";
  const [tipo, ...resto] = data.split(":");

  /* El vínculo se resuelve antes de tocar nada, incluso para `u` y `y`: un
     botón de un chat sin negocio no tiene a quién referirse. */
  const negocio = await cargarNegocio(chatId);
  if (!negocio) {
    await responderCallback(
      callbackId,
      "Este chat ya no está unido a ningún negocio.",
      true,
    );
    return;
  }

  switch (tipo) {
    case "cmd": {
      /* Un botón del menú es un comando con otro nombre: `cmd:carta` y `/carta`
         acaban en la misma función, así que no hay dos caminos que mantener. */
      const cmd = resto[0] ?? "";
      if (!A.esComandoValido(cmd) || cmd === "start") {
        await responderCallback(callbackId, "Ese botón ya no vale.", true);
        return;
      }
      await responderCallback(callbackId, "");
      await manejarComando(negocio, update, cmd, "");
      return;
    }

    case "p": {
      /* Paginar no escribe: no se responde con alerta, solo se cambia el
         mensaje que ya está en pantalla. */
      const estado: Disponibilidad =
        resto[0] === "agotado" ? "agotado" : "disponible";
      const desde = Number.parseInt(resto[1] ?? "0", 10) || 0;
      await responderCallback(callbackId, "");
      const productos = productosDe(negocio.menu);
      const pagina = productos.slice(desde, desde + A.TAMANO_PAGINA);
      const filas: Boton[][] = pagina.map((prod) => [
        {
          text: A.recortarEtiqueta(prod.name),
          callback_data: `d:${estado}:${prod.indice}`,
        },
      ]);
      const nav: Boton[] = [];
      if (desde > 0)
        nav.push({
          text: "← Antes",
          callback_data: `p:${estado}:${Math.max(0, desde - A.TAMANO_PAGINA)}`,
        });
      if (desde + A.TAMANO_PAGINA < productos.length) {
        nav.push({
          text: "Después →",
          callback_data: `p:${estado}:${desde + A.TAMANO_PAGINA}`,
        });
      }
      if (nav.length > 0) filas.push(nav);
      if (update.callback_mensaje_id) {
        const verbo = estado === "agotado" ? "se acabó" : "ya hay";
        await editarTexto(
          chatId,
          update.callback_mensaje_id,
          `¿Qué ${verbo}? Toca el producto (${desde + 1}–${desde + pagina.length} de ${productos.length}):`,
          filas,
        );
      }
      return;
    }

    case "d": {
      const estado: Disponibilidad =
        resto[0] === "agotado" ? "agotado" : "disponible";
      const indice = Number.parseInt(resto[1] ?? "", 10);
      const res = await ejecutarDisponibilidad(negocio, indice, estado, null);
      const logId = await registrarLog({
        negocioId: negocio.negocioId,
        chatId,
        mensaje: null,
        accion: res.accion,
        antes: res.antes,
        despues: res.despues,
        via: "comando",
      });
      await responderCallback(callbackId, res.texto);
      if (update.callback_mensaje_id) {
        await editarTexto(
          chatId,
          update.callback_mensaje_id,
          res.texto,
          logId
            ? [[{ text: "Deshacer", callback_data: `u:${logId}` }]]
            : undefined,
        );
      }
      return;
    }

    case "c": {
      /* El dueño eligió, entre los candidatos, a cuál se refería. */
      const elegido = await elegirCandidato(
        resto[0] ?? "",
        negocio,
        Number.parseInt(resto[1] ?? "", 10),
      );
      await responderCallback(callbackId, elegido.aviso, elegido.alerta);
      if (update.callback_mensaje_id) {
        await editarTexto(
          chatId,
          update.callback_mensaje_id,
          elegido.texto,
          elegido.botones,
        );
      }
      return;
    }

    case "u": {
      const texto = await deshacer(resto[0] ?? "", negocio);
      await responderCallback(callbackId, texto);
      if (update.callback_mensaje_id) {
        await editarTexto(chatId, update.callback_mensaje_id, texto);
      }
      return;
    }

    case "n": {
      /* Un «no» borra la fila: una confirmación rechazada no es historia que
         valga la pena guardar. */
      await db.delete(asistenteLog).where(eq(asistenteLog.id, resto[0] ?? ""));
      await responderCallback(callbackId, "Vale, no toco nada.");
      if (update.callback_mensaje_id) {
        await editarTexto(
          chatId,
          update.callback_mensaje_id,
          "Vale, no toco nada.",
        );
      }
      return;
    }

    case "y": {
      const aplicado = await aplicarPendiente(resto[0] ?? "", negocio);
      await responderCallback(callbackId, aplicado.texto);
      if (update.callback_mensaje_id) {
        /* Con Deshacer si quedó aplicado: un cambio confirmado sigue siendo un
           cambio, y la promesa del asistente es que todo se puede deshacer. */
        await editarTexto(
          chatId,
          update.callback_mensaje_id,
          aplicado.texto,
          aplicado.logId
            ? [[{ text: "Deshacer", callback_data: `u:${aplicado.logId}` }]]
            : undefined,
        );
      }
      return;
    }

    default:
      await responderCallback(callbackId, "Ese botón ya no vale.", true);
  }
}

/** Lo que se cuenta al pulsar «Sí». `logId` va puesto solo si quedó aplicado —y
 * por tanto se puede deshacer—; `null` en un «no se pudo», que no da Deshacer. */
interface Aplicado {
  texto: string;
  logId: string | null;
}

/**
 * El dueño tocó un candidato de la lista.
 *
 * Se anota **cuál** en la fila que ya estaba esperando y se sigue el camino de
 * siempre: un precio todavía pregunta —y ahora la frase se puede escribir con el
 * nombre bueno—; lo demás se aplica y se ofrece deshacer.
 *
 * Se reescribe la fila en vez de aplicar ahí mismo para no abrir un segundo
 * camino de escritura: `aplicarPendiente` es el único que aplica, y el producto
 * del modelo vuelve a pasar por la resolución contra la carta como cualquier
 * otro. */
async function elegirCandidato(
  logId: string,
  negocio: Negocio,
  indice: number,
): Promise<{
  aviso: string;
  alerta: boolean;
  texto: string;
  botones?: Boton[][];
}> {
  const [fila] = await db
    .select()
    .from(asistenteLog)
    .where(
      and(
        eq(asistenteLog.id, logId),
        eq(asistenteLog.negocioId, negocio.negocioId),
        eq(asistenteLog.pendiente, true),
      ),
    )
    .limit(1);

  if (!fila) {
    return {
      aviso: "Ese botón ya no vale.",
      alerta: true,
      texto: "Ese botón ya no vale.",
    };
  }

  const producto = productosDe(negocio.menu)[indice];
  if (!producto) {
    await db.delete(asistenteLog).where(eq(asistenteLog.id, logId));
    return {
      aviso: "Ese producto ya no está en tu carta.",
      alerta: true,
      texto: "Ese producto ya no está en tu carta.",
    };
  }

  const intencion: Record<string, unknown> = {
    ...((fila.despues ?? {}) as Record<string, unknown>),
    producto: producto.name,
  };
  await db
    .update(asistenteLog)
    .set({ despues: intencion as never })
    .where(eq(asistenteLog.id, logId));

  if (fila.accion === "set_precio") {
    const precio = typeof intencion.precio === "string" ? intencion.precio : "";
    return {
      aviso: "",
      alerta: false,
      texto: `Cambio «${producto.name}» a ${precio}.`,
      botones: botonesSiNo(logId),
    };
  }

  const aplicado = await aplicarPendiente(logId, negocio);
  return {
    aviso: aplicado.texto,
    alerta: false,
    texto: aplicado.texto,
    ...(aplicado.logId
      ? {
          botones: [
            [{ text: "Deshacer", callback_data: `u:${aplicado.logId}` }],
          ],
        }
      : {}),
  };
}

/** Aplica un cambio que estaba esperando el «Sí».
 *
 * Re-ejecuta **la intención que se guardó al preguntar** —lo que propuso el
 * modelo— por el mismo camino que la habría aplicado sin confirmación, que es el
 * que resuelve el producto contra la carta. Si algo falla, la fila se borra: una
 * confirmación que no llegó a nada no es historia que valga la pena guardar. */
async function aplicarPendiente(
  logId: string,
  negocio: Negocio,
): Promise<Aplicado> {
  const [fila] = await db
    .select()
    .from(asistenteLog)
    .where(
      and(
        eq(asistenteLog.id, logId),
        eq(asistenteLog.negocioId, negocio.negocioId),
        eq(asistenteLog.pendiente, true),
      ),
    )
    .limit(1);

  if (!fila) return { texto: "Ese cambio ya no está esperando.", logId: null };

  const intencion = (fila.despues ?? {}) as Record<string, unknown>;
  const res = await ejecutarAccionModelo(negocio, fila.accion, intencion);

  if (!res || !res.ok) {
    await db.delete(asistenteLog).where(eq(asistenteLog.id, logId));
    return {
      texto: res?.texto ?? "No pude aplicarlo. Prueba otra vez.",
      logId: null,
    };
  }

  /* La fila pasa de «pendiente» a «hecha», y se le escriben el antes y el
     después de verdad: es lo que el Deshacer va a leer. */
  await db
    .update(asistenteLog)
    .set({
      antes: res.antes as never,
      despues: res.despues as never,
      pendiente: false,
    })
    .where(eq(asistenteLog.id, logId));

  return { texto: res.texto, logId };
}

/** El botón «Deshacer» que acompaña a un cambio ya aplicado. */
async function ofrecerDeshacer(
  chatId: string,
  logId: string | null,
): Promise<void> {
  if (!logId) return;
  await enviarBotones(chatId, "¿Algo mal?", [
    [{ text: "Deshacer", callback_data: `u:${logId}` }],
  ]);
}
