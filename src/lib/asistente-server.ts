import { and, desc, eq, gte, sql } from "drizzle-orm";
import { chatJSON } from "@/lib/ai";
import { resolveBotProviders } from "@/lib/ai/providers-store";
import { db } from "@/lib/db";
import { invalidarCatalogo, placeStats } from "@/lib/db/queries";
import {
  asistenteCodigos,
  asistenteLog,
  businessOwners,
  placeMetrics,
  places,
  telegramUpdates,
  telegramVinculos,
} from "@/lib/db/schema";
import {
  normalizarPermisos,
  permisoDeAccion,
  type PermisoNegocio,
} from "@/lib/permisos-negocio";
import {
  estaAgotado,
  hastaManana,
  type Disponibilidad,
} from "@/lib/disponibilidad";
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
  /** `null` en los vínculos anteriores a los trabajadores: se tratan como dueño. */
  userId: string | null;
  esDueno: boolean;
  permisos: Set<PermisoNegocio>;
}

async function cargarNegocio(chatId: string): Promise<Negocio | null> {
  const [fila] = await db
    .select({
      negocioId: telegramVinculos.negocioId,
      nombre: places.name,
      menu: places.menu,
      status: places.status,
      schedule: places.schedule,
      userId: telegramVinculos.userId,
      rol: businessOwners.role,
      permisos: businessOwners.permissions,
    })
    .from(telegramVinculos)
    .innerJoin(places, eq(places.id, telegramVinculos.negocioId))
    /* La fila del trabajador, si la hay. Un vínculo sin `user_id` —anterior a
       los trabajadores o creado por un script— no casa con nada y se queda
       como dueño. */
    .leftJoin(
      businessOwners,
      and(
        eq(businessOwners.userId, telegramVinculos.userId),
        eq(businessOwners.placeId, telegramVinculos.negocioId),
      ),
    )
    .where(eq(telegramVinculos.chatId, chatId))
    .limit(1);

  if (!fila) return null;

  /* Un chat con usuario pero sin fila es alguien a quien le quitaron el acceso:
     no se le deja ni leer. */
  if (fila.userId && !fila.rol) return null;

  const esDueno = !fila.userId || fila.rol === "owner";

  return {
    negocioId: fila.negocioId,
    nombre: fila.nombre,
    menu: fila.menu,
    status: fila.status,
    schedule: fila.schedule,
    userId: fila.userId ?? null,
    esDueno,
    permisos: esDueno
      ? new Set<PermisoNegocio>()
      : new Set(normalizarPermisos(fila.permisos)),
  };
}

/** ¿Puede este chat hacer algo que exige `permiso`? El dueño puede todo. */
function permite(negocio: Negocio, permiso: PermisoNegocio | null): boolean {
  if (!permiso) return true;
  return negocio.esDueno || negocio.permisos.has(permiso);
}

/**
 * La respuesta de una escritura que el trabajador no tiene permitida.
 *
 * Devuelve la forma de `Resultado` para que las mismas funciones que ejecutan
 * los cambios puedan negarlos sin que cada camino —texto libre, regex, modelo,
 * botón o confirmación— tenga que acordarse de comprobarlo.
 */
function negado(accion: string, permiso: PermisoNegocio): Resultado {
  const motivo =
    permiso === "catalogo"
      ? "El dueño no te dio permiso para cambiar el catálogo."
      : "El dueño no te dio permiso para cambiar la ficha del negocio.";
  return { ok: false, accion, antes: null, despues: null, texto: motivo };
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
  invalidarCatalogo();
}

async function ejecutarDisponibilidad(
  negocio: Negocio,
  indice: number,
  estado: Disponibilidad,
  hasta: number | null,
): Promise<Resultado> {
  if (!permite(negocio, "catalogo")) return negado("set_disponibilidad", "catalogo");
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
  if (!permite(negocio, "catalogo")) return negado("set_precio", "catalogo");
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

type ItemMenu = NonNullable<Menu>[number];

/** «Pan — 25 CUP», para la respuesta del alta. */
function lineaProducto(item: ItemMenu): string {
  const precio = [item.price?.trim(), item.currency?.trim()]
    .filter(Boolean)
    .join(" ");
  return `• ${item.name}${precio ? ` — ${precio}` : ""}`;
}

/**
 * Añade varios productos de una vez. Es el único camino del alta.
 *
 * Los nombres repetidos se saltan —comparando sin acentos ni artículo, como
 * `buscarProducto`— para que reenviar el mismo mensaje no llene la carta de
 * duplicados. El `npm` id se genera aquí y no lo decide el texto.
 */
async function ejecutarAgregarProductos(
  negocio: Negocio,
  nuevos: A.ProductoNuevo[],
): Promise<Resultado> {
  if (!permite(negocio, "catalogo")) return negado("agregar_productos", "catalogo");
  const menu = negocio.menu ?? [];
  const vistos = new Set(
    menu.map((item) => A.sinAcento(A.sinArticulo(item.name))),
  );
  const creados: ItemMenu[] = [];
  const repetidos: string[] = [];

  for (const nuevo of nuevos) {
    const clave = A.sinAcento(A.sinArticulo(nuevo.nombre));
    if (!clave) continue;
    if (vistos.has(clave)) {
      repetidos.push(nuevo.nombre);
      continue;
    }
    vistos.add(clave);
    creados.push({
      id: generateId(),
      name: nuevo.nombre,
      description: nuevo.descripcion,
      price: nuevo.precio,
      currency: nuevo.moneda,
      ...(nuevo.categoria ? { category: nuevo.categoria } : {}),
      ...(nuevo.etiqueta ? { tag: nuevo.etiqueta } : {}),
    });
  }

  const antes = { ids: [] as string[] };
  const despues = { ids: creados.map((item) => item.id as string) };

  if (creados.length === 0) {
    return {
      ok: false,
      accion: "agregar_productos",
      antes,
      despues,
      texto:
        repetidos.length > 0
          ? `Esos productos ya están en tu carta: ${repetidos.map((n) => `«${n}»`).join(", ")}.`
          : "No me llegó ningún producto con nombre.",
    };
  }

  await escribirMenu(negocio.negocioId, [...menu, ...creados]);

  const yaEstaban =
    repetidos.length > 0
      ? `\n\nYa estaban en tu carta: ${repetidos.map((n) => `«${n}»`).join(", ")}.`
      : "";
  const cuantos =
    creados.length === 1 ? "1 producto" : `${creados.length} productos`;

  return {
    ok: true,
    accion: "agregar_productos",
    antes,
    despues,
    texto:
      `Listo: añadí ${cuantos} a tu carta:\n${creados.map(lineaProducto).join("\n")}${yaEstaban}` +
      "\n\nPor ahora, para cargar la imagen de un producto tienes que hacerlo desde el panel de tu negocio.",
  };
}

/** Cambia solo los campos que llegaron. `null` = el producto ya no está. */
async function ejecutarEditarProducto(
  negocio: Negocio,
  indice: number,
  cambios: Partial<
    Pick<ItemMenu, "name" | "description" | "price" | "currency" | "tag" | "category">
  >,
): Promise<Resultado | null> {
  if (!permite(negocio, "catalogo")) return negado("editar_producto", "catalogo");
  const menu = negocio.menu ?? [];
  const item = menu[indice];
  if (!item) return null;

  const productoId = item.id ?? String(indice);
  const antes = { productoId, item };
  const despuesItem = { ...item, ...cambios };
  const despues = { productoId, item: despuesItem };

  if (Object.keys(cambios).length === 0) {
    return {
      ok: false,
      accion: "editar_producto",
      antes,
      despues: antes,
      texto: `No me dijiste qué cambiar de «${item.name}».`,
    };
  }

  await escribirMenu(
    negocio.negocioId,
    menu.map((entrada, i) => (i === indice ? despuesItem : entrada)),
  );

  return {
    ok: true,
    accion: "editar_producto",
    antes,
    despues,
    texto: `Listo: actualicé «${despuesItem.name}» en tu carta.`,
  };
}

/** Quita el producto de la carta, guardando dónde estaba para el Deshacer. */
async function ejecutarEliminarProducto(
  negocio: Negocio,
  indice: number,
): Promise<Resultado | null> {
  if (!permite(negocio, "catalogo")) return negado("eliminar_producto", "catalogo");
  const menu = negocio.menu ?? [];
  const item = menu[indice];
  if (!item) return null;

  const productoId = item.id ?? String(indice);
  const antes = { productoId, indice, item };
  const despues = { productoId };

  await escribirMenu(
    negocio.negocioId,
    menu.filter((_, i) => i !== indice),
  );

  return {
    ok: true,
    accion: "eliminar_producto",
    antes,
    despues,
    texto: `Listo: quité «${item.name}» de tu carta.`,
  };
}

async function ejecutarHorario(
  negocio: Negocio,
  texto: string,
): Promise<Resultado> {
  if (!permite(negocio, "ficha")) return negado("set_horario", "ficha");
  const horarioAntes = negocio.schedule ?? "";
  await db
    .update(places)
    .set({ schedule: texto })
    .where(eq(places.id, negocio.negocioId));
  invalidarCatalogo();

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
  if (!permite(negocio, "ficha")) return negado("abrir_cerrar_hoy", "ficha");
  const status: EstadoNegocio = abierto ? "active" : "closed";
  const antes = { status: negocio.status };
  await db
    .update(places)
    .set({ status })
    .where(eq(places.id, negocio.negocioId));
  invalidarCatalogo();

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

  /* Deshacer escribe igual que la acción original: mismo permiso, y se mira
     ahora y no cuando se hizo el cambio. */
  const exigido = permisoDeAccion(fila.accion);
  if (!permite(negocio, exigido)) {
    return exigido === "catalogo"
      ? "El dueño no te dio permiso para cambiar el catálogo."
      : "El dueño no te dio permiso para cambiar la ficha del negocio.";
  }

  const antes = fila.antes as Record<string, unknown> | null;
  const despues = fila.despues as Record<string, unknown> | null;

  if (fila.accion === "agregar_productos" && despues) {
    /* Deshacer un alta es quitar lo que se añadió: los ids viajaron en el
       `despues` porque el `antes` de una carta que crece no tiene nada que
       devolver. */
    const ids = Array.isArray(despues.ids)
      ? new Set(despues.ids.map(String))
      : new Set<string>();
    await escribirMenu(
      negocio.negocioId,
      (negocio.menu ?? []).filter(
        (item, i) => !ids.has(item.id ?? String(i)),
      ),
    );
  } else if (fila.accion === "editar_producto" && antes) {
    const item = antes.item as ItemMenu | undefined;
    const productoId = String(antes.productoId ?? "");
    const menu = negocio.menu ?? [];
    const indice = menu.findIndex(
      (entrada, i) => (entrada.id ?? String(i)) === productoId,
    );
    if (indice !== -1 && item) {
      await escribirMenu(
        negocio.negocioId,
        menu.map((entrada, i) => (i === indice ? item : entrada)),
      );
    }
  } else if (fila.accion === "eliminar_producto" && antes) {
    const item = antes.item as ItemMenu | undefined;
    if (item) {
      const menu = [...(negocio.menu ?? [])];
      const indice = Number(antes.indice);
      const donde =
        Number.isInteger(indice) && indice >= 0
          ? Math.min(indice, menu.length)
          : menu.length;
      menu.splice(donde, 0, item);
      await escribirMenu(negocio.negocioId, menu);
    }
  } else if (fila.accion === "set_disponibilidad" && antes) {
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
    invalidarCatalogo();
  } else if (fila.accion === "abrir_cerrar_hoy" && antes) {
    await db
      .update(places)
      .set({ status: antes.status as EstadoNegocio })
      .where(eq(places.id, negocio.negocioId));
    invalidarCatalogo();
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
  "/catalogo — editar tus productos con botones: datos y estado",
  "/nuevo — añadir productos a tu carta desde el chat",
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
  [{ text: "Editar mi catálogo", callback_data: "cmd:catalogo" }],
  [{ text: "Añadir productos", callback_data: "cmd:nuevo" }],
  [
    { text: "Marcar agotado", callback_data: "cmd:agotado" },
    { text: "Marcar disponible", callback_data: "cmd:disponible" },
  ],
  [
    { text: "Abrir hoy", callback_data: "cmd:abrir" },
    { text: "Cerrar hoy", callback_data: "cmd:cerrar" },
  ],
];

/** Volver al menú. **Todo** mensaje que termina lo lleva: una pantalla sin
 * botones obliga a subir a buscar el mensaje anterior o a mandar /start otra
 * vez. */
const BTN_MENU: Boton = { text: "← Menú", callback_data: "m" };

/** La fila mínima de salida para un mensaje suelto. */
function soloMenu(): Boton[][] {
  return [[BTN_MENU]];
}

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

  /* Un trabajador puede tener el chat vinculado y, aun así, que le quiten el
     acceso al asistente: el permiso se mira en cada mensaje, no al vincular. */
  if (!permite(negocio, "telegram")) {
    await enviarTexto(
      update.chat_id,
      "El dueño te quitó el acceso al asistente. Pídele que te lo devuelva desde el panel.",
    );
    return;
  }

  if (comando) {
    /* Cualquier barra cancela la espera de un valor de campo: si el dueño toca
       otro sitio, el mensaje siguiente no es el valor de nada. */
    await limpiarCampoPendiente(update.chat_id);
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

  /* Un campo esperando su valor va antes que el saludo y que la IA: el mensaje
     es el valor, no una orden. Lo mismo con el alta guiada. */
  if (await manejarCampoPendiente(negocio, update)) return;
  if (await manejarAltaPendiente(negocio, update)) return;

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
    .returning({
      negocioId: asistenteCodigos.negocioId,
      userId: asistenteCodigos.userId,
    });

  if (!canjeado) {
    await enviarTexto(
      chatId,
      "Ese código no me vale: o ya se usó, o se le pasaron los diez minutos. Genera otro en el panel de tu negocio.",
    );
    return;
  }

  const negocioId = canjeado.negocioId;

  /* Dos puertas, una vinculación: `telegram_menu` entra desde Esencial y sirve
     para todo lo que se hace con comandos y botones; `asistente_ia` añade la
     capa de frases libres del plan Pro. */
  const puedeMenu = await puede(negocioId, "telegram_menu");
  if (!puedeMenu && !(await puede(negocioId, "asistente_ia"))) {
    await enviarTexto(
      chatId,
      "Ese negocio no tiene el asistente de Telegram contratado. Viene incluido en Esencial y Pro; puedes activarlo desde el panel.",
    );
    return;
  }

  /* El rol guardado es informativo: los permisos reales se leen de
     `business_owners` en cada mensaje, así que quitárselos a alguien surte
     efecto sin volver a vincular el chat. */
  const [staff] =
    canjeado.userId === null
      ? []
      : await db
          .select({ rol: businessOwners.role })
          .from(businessOwners)
          .where(
            and(
              eq(businessOwners.userId, canjeado.userId),
              eq(businessOwners.placeId, negocioId),
            ),
          )
          .limit(1);
  const rol = !canjeado.userId || staff?.rol === "owner" ? "dueno" : "empleado";

  /* `onConflictDoUpdate` sobre el `unique` de `chat_id`: un chat, un negocio. Si
     ese chat ya estaba unido a otro, se reescribe —que es lo que se quiere al
     cambiar de negocio—. */
  await db
    .insert(telegramVinculos)
    .values({
      id: generateId(),
      negocioId,
      chatId,
      userId: canjeado.userId,
      rol,
    })
    .onConflictDoUpdate({
      target: telegramVinculos.chatId,
      set: { negocioId, userId: canjeado.userId, rol, updatedAt: ahora },
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

/** El permiso que exige un comando. Los de lectura no exigen ninguno más. */
function permisoDeComando(comando: string): PermisoNegocio | null {
  switch (comando) {
    case "nuevo":
    case "agotado":
    case "disponible":
      return "catalogo";
    case "abrir":
    case "cerrar":
      return "ficha";
    default:
      return null;
  }
}

async function manejarComando(
  negocio: Negocio,
  update: A.ParsedTelegram,
  comando: string,
  resto: string,
): Promise<void> {
  const chatId = update.chat_id;

  const exigido = permisoDeComando(comando);
  if (!permite(negocio, exigido)) {
    await enviarTexto(
      chatId,
      exigido === "catalogo"
        ? "El dueño no te dio permiso para cambiar el catálogo."
        : "El dueño no te dio permiso para cambiar la ficha del negocio.",
    );
    return;
  }

  switch (comando) {
    case "ayuda":
    case "help":
      await enviarBotones(chatId, AYUDA, MENU);
      return;

    case "stats":
      await enviarBotones(
        chatId,
        await textoStats(negocio.negocioId),
        soloMenu(),
      );
      return;

    case "carta":
      await enviarBotones(chatId, A.textoCarta(negocio.menu ?? []), MENU);
      return;

    case "catalogo":
      await enviarCategoriasCatalogo(negocio, chatId, 0);
      return;

    case "nuevo":
      await enviarMenuAlta(chatId);
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
      await responderConDeshacer(chatId, res, logId);
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
      await enviarBotones(chatId, "Ese no lo tengo. Escribe /ayuda.", soloMenu());
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
    await enviarBotones(
      chatId,
      "Tu carta todavía no tiene productos. Mándame /nuevo para añadirlos desde aquí y luego /carta para verla.",
      [
        [{ text: "Añadir productos", callback_data: "cmd:nuevo" }],
        [BTN_MENU],
      ],
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
  filas.push([BTN_MENU]);

  const verbo = estado === "agotado" ? "se acabó" : "ya hay";
  await enviarBotones(
    chatId,
    `¿Qué ${verbo}? Toca el producto (${desde + 1}–${desde + pagina.length} de ${productos.length}):`,
    filas,
  );
}

/* ── el catálogo guiado: producto → campo → valor ─────────────────────────
   Todo lo que se puede hacer con la carta, sin escribir comandos ni pasar por el
   modelo: una lista con un botón por producto, una ficha con un botón por campo
   y un mensaje que pide solo el valor nuevo.

   Los callbacks nuevos llevan el **id** del producto y no su índice. El id de
   Telegram cabe en los 64 bytes (`f:<uuid>:p` son 40) y no se corre al borrar un
   producto de en medio, que es lo que sí le pasa al índice de las listas viejas.

   El valor que se espera no vive en memoria: se deja una fila `campo_producto`
   pendiente en `asistente_log`, igual que las confirmaciones, así que sobrevive a
   un arranque en frío. Al aplicarse se reescribe como `editar_producto`, y el
   Deshacer de siempre la lee sin saber que nació de un botón. */

const CAMPO_PENDIENTE_TTL_MS = 10 * 60_000;

function productoAgotado(negocio: Negocio, indice: number): boolean {
  const item = negocio.menu?.[indice];
  return item ? estaAgotado(item, Date.now()) : false;
}

/** Un producto de la carta por id, con el índice que hoy ocupa. */
function indicePorId(negocio: Negocio, productoId: string): number {
  return indiceDe(productosDe(negocio.menu), productoId);
}

function idDe(negocio: Negocio, indice: number): string {
  return negocio.menu?.[indice]?.id ?? String(indice);
}

/** El catálogo, primero por categorías. La lista se enseña siempre, aunque solo
 * haya una: es el paso desde el que se entra a sus productos y al que se vuelve
 * con «← Categorías». */
async function enviarCategoriasCatalogo(
  negocio: Negocio,
  chatId: string,
  desde: number,
  mensajeId?: number,
): Promise<void> {
  const productos = productosDe(negocio.menu);
  if (productos.length === 0) {
    const texto =
      "Tu carta todavía no tiene productos. Mándame /nuevo para añadirlos y luego /catalogo para editarlos.";
    const filas: Boton[][] = [
      [{ text: "Añadir productos", callback_data: "cmd:nuevo" }],
      [BTN_MENU],
    ];
    if (mensajeId) await editarTexto(chatId, mensajeId, texto, filas);
    else await enviarBotones(chatId, texto, filas);
    return;
  }

  const categorias = A.categoriasDe(negocio.menu ?? []);
  const pagina = categorias.slice(desde, desde + A.TAMANO_PAGINA);
  const filas: Boton[][] = pagina.map((categoria, i) => [
    {
      text: `${A.recortarEtiqueta(categoria.nombre, 50)} (${categoria.indices.length})`,
      callback_data: `g:${desde + i}`,
    },
  ]);

  const nav: Boton[] = [];
  if (desde > 0) {
    nav.push({
      text: "← Antes",
      callback_data: `l:${Math.max(0, desde - A.TAMANO_PAGINA)}`,
    });
  }
  if (desde + A.TAMANO_PAGINA < categorias.length) {
    nav.push({
      text: "Después →",
      callback_data: `l:${desde + A.TAMANO_PAGINA}`,
    });
  }
  if (nav.length > 0) filas.push(nav);
  filas.push([BTN_MENU]);

  const texto = `Tu catálogo por categorías (${desde + 1}–${desde + pagina.length} de ${categorias.length}). Elige una:`;
  if (mensajeId) await editarTexto(chatId, mensajeId, texto, filas);
  else await enviarBotones(chatId, texto, filas);
}

/** Los productos de una categoría, cada uno con su estado delante. */
async function enviarProductosCategoria(
  negocio: Negocio,
  chatId: string,
  categoriaIndice: number,
  desde: number,
  mensajeId?: number,
): Promise<void> {
  const productos = productosDe(negocio.menu);
  const categorias = A.categoriasDe(negocio.menu ?? []);
  const categoria = categorias[categoriaIndice];

  /* La lista cambió entre que se pintó y el toque: se vuelve a empezar. */
  if (!categoria) {
    await enviarCategoriasCatalogo(negocio, chatId, 0, mensajeId);
    return;
  }

  const dentro = categoria.indices
    .map((i) => productos[i])
    .filter((p): p is Producto => p !== undefined);
  const pagina = dentro.slice(desde, desde + A.TAMANO_PAGINA);
  const filas: Boton[][] = pagina.map((p) => [
    {
      text: `${productoAgotado(negocio, p.indice) ? "⛔" : "✅"} ${A.recortarEtiqueta(p.name, 52)}`,
      callback_data: `i:${p.id}`,
    },
  ]);

  const nav: Boton[] = [];
  if (desde > 0) {
    nav.push({
      text: "← Antes",
      callback_data: `g:${categoriaIndice}:${Math.max(0, desde - A.TAMANO_PAGINA)}`,
    });
  }
  if (desde + A.TAMANO_PAGINA < dentro.length) {
    nav.push({
      text: "Después →",
      callback_data: `g:${categoriaIndice}:${desde + A.TAMANO_PAGINA}`,
    });
  }
  if (nav.length > 0) filas.push(nav);

  filas.push([{ text: "← Categorías", callback_data: "l" }]);

  const rango = `${desde + 1}–${desde + pagina.length} de ${dentro.length}`;
  const texto = `«${A.recortarEtiqueta(categoria.nombre, 30)}» (${rango}). Toca un producto para ver sus datos y editarlo:`;
  if (mensajeId) await editarTexto(chatId, mensajeId, texto, filas);
  else await enviarBotones(chatId, texto, filas);
}

/** A dónde vuelve «← Volver» desde la ficha: a su categoría, en la página donde
 * está el producto. */
function botonVolver(negocio: Negocio, indice: number): Boton {
  const categorias = A.categoriasDe(negocio.menu ?? []);
  const clave = A.sinAcento((negocio.menu?.[indice]?.category ?? "").trim());
  const categoria = categorias.find((c) => c.clave === clave);
  if (categoria) {
    const pos = categoria.indices.indexOf(indice);
    const desde =
      pos === -1 ? 0 : Math.floor(pos / A.TAMANO_PAGINA) * A.TAMANO_PAGINA;
    return {
      text: "← Volver",
      callback_data: `g:${categorias.indexOf(categoria)}:${desde}`,
    };
  }
  return { text: "← Volver", callback_data: "l" };
}

/** Los botones de la ficha. Sin permiso de catálogo solo queda «Volver»: es más
 * honesto que enseñar botones que van a contestar que no. */
function botonesFicha(negocio: Negocio, indice: number): Boton[][] {
  const id = idDe(negocio, indice);
  const filas: Boton[][] = [];

  if (permite(negocio, "catalogo")) {
    const campo = (codigo: string, label: string): Boton => ({
      text: label,
      callback_data: `f:${id}:${codigo}`,
    });
    filas.push([campo("n", "Nombre"), campo("d", "Descripción")]);
    filas.push([campo("p", "Precio"), campo("m", "Moneda")]);
    filas.push([campo("c", "Categoría"), campo("e", "Etiqueta")]);
    filas.push([
      {
        text: productoAgotado(negocio, indice)
          ? "Marcar disponible"
          : "Marcar agotado",
        callback_data: `t:${id}`,
      },
    ]);
    filas.push([{ text: "Quitar producto", callback_data: `x:${id}` }]);
  }

  filas.push([botonVolver(negocio, indice)]);
  return filas;
}

/** La ficha de un producto. `mensajeId` la escribe encima del mensaje anterior
 * —la lista, o la propia ficha— en vez de mandar otro mensaje. */
async function enviarFichaProducto(
  negocio: Negocio,
  chatId: string,
  productoId: string,
  mensajeId?: number,
  logId?: string | null,
): Promise<void> {
  const indice = indicePorId(negocio, productoId);
  const item = indice === -1 ? undefined : negocio.menu?.[indice];

  if (!item || indice === -1) {
    const texto = "Ese producto ya no está en tu carta. Abre /catalogo y elige otro.";
    const filas: Boton[][] = [[{ text: "← Catálogo", callback_data: "l" }]];
    if (mensajeId) await editarTexto(chatId, mensajeId, texto, filas);
    else await enviarBotones(chatId, texto, filas);
    return;
  }

  const sinPermiso = permite(negocio, "catalogo")
    ? ""
    : "\n\nNo tienes permiso para cambiar el catálogo.";
  const texto = `${A.textoFichaProducto(item, productoAgotado(negocio, indice))}${sinPermiso}`;
  const filas = botonesFicha(negocio, indice);
  if (logId) filas.push([{ text: "Deshacer", callback_data: `u:${logId}` }]);

  if (mensajeId) await editarTexto(chatId, mensajeId, texto, filas);
  else await enviarBotones(chatId, texto, filas);
}

/** Deja anotado qué campo se está esperando y pide el valor. */
async function pedirValorCampo(
  negocio: Negocio,
  chatId: string,
  productoId: string,
  codigo: string,
): Promise<void> {
  if (!permite(negocio, "catalogo")) {
    await enviarBotones(
      chatId,
      "El dueño no te dio permiso para cambiar el catálogo.",
      soloMenu(),
    );
    return;
  }

  /* Editar un campo cancela un alta a medias: el mensaje siguiente es el valor
     del campo, no el nombre de un producto nuevo. */
  await limpiarAltaPendiente(chatId);

  const campo = A.campoDeCodigo(codigo);
  const indice = indicePorId(negocio, productoId);
  const item = indice === -1 ? undefined : negocio.menu?.[indice];
  if (!campo || !item) {
    await enviarBotones(
      chatId,
      "Ese producto ya no está en tu carta. Abre /catalogo y elige otro.",
      soloMenu(),
    );
    return;
  }

  const logId = await registrarLog({
    negocioId: negocio.negocioId,
    chatId,
    mensaje: null,
    accion: "campo_producto",
    antes: null,
    despues: { productoId, campo: campo.codigo },
    via: "comando",
    pendiente: true,
  });

  if (!logId) {
    await enviarBotones(
      chatId,
      "No pude dejar el cambio preparado. Prueba otra vez.",
      soloMenu(),
    );
    return;
  }

  await enviarBotones(
    chatId,
    A.preguntaCampo(campo, item.name, A.valorDeCampo(item, campo.clave)),
    [[{ text: "Cancelar", callback_data: `z:${logId}` }]],
  );
}

/** La fila que espera el valor de un campo, si la hay y no ha caducado. */
async function campoPendiente(negocio: Negocio, chatId: string) {
  const [fila] = await db
    .select()
    .from(asistenteLog)
    .where(
      and(
        eq(asistenteLog.chatId, chatId),
        eq(asistenteLog.negocioId, negocio.negocioId),
        eq(asistenteLog.accion, "campo_producto"),
        eq(asistenteLog.pendiente, true),
      ),
    )
    .orderBy(desc(asistenteLog.ts))
    .limit(1);

  if (!fila) return null;
  if (Date.now() - fila.ts.getTime() > CAMPO_PENDIENTE_TTL_MS) {
    await db.delete(asistenteLog).where(eq(asistenteLog.id, fila.id));
    return null;
  }
  return fila;
}

/** Cualquier comando cancela la espera: si el dueño toca otro sitio, el mensaje
 * siguiente no es un valor de campo. */
async function limpiarCampoPendiente(chatId: string): Promise<void> {
  await db
    .delete(asistenteLog)
    .where(
      and(
        eq(asistenteLog.chatId, chatId),
        eq(asistenteLog.accion, "campo_producto"),
        eq(asistenteLog.pendiente, true),
      ),
    );
  await limpiarAltaPendiente(chatId);
}

/* ── el alta guiada: nombre → precio → categoría ──────────────────────────
   Añadir un producto sin escribir la plantilla: el bot pide un dato cada vez y
   los que se pueden elegir —la categoría— se tocan. El borrador vive en
   `asistente_log` como las demás esperas, así que aguanta un arranque en frío.
   Al final la fila se reescribe como `agregar_productos`, y el Deshacer de
   siempre la lee sin saber que nació de botones. */

type PasoAlta = "nombre" | "precio" | "categoria";

interface BorradorAlta {
  paso: PasoAlta;
  nombre?: string;
  precio?: string;
}

/** Borra el alta a medias del chat. Se usa al empezar otra y cuando cualquier
 * comando demuestra que el dueño se fue a otro sitio. */
function limpiarAltaPendiente(chatId: string): Promise<unknown> {
  return db
    .delete(asistenteLog)
    .where(
      and(
        eq(asistenteLog.chatId, chatId),
        eq(asistenteLog.accion, "alta_producto"),
        eq(asistenteLog.pendiente, true),
      ),
    );
}

/** La fila del alta a medias, si la hay y no ha caducado. */
async function altaPendiente(negocio: Negocio, chatId: string) {
  const [fila] = await db
    .select()
    .from(asistenteLog)
    .where(
      and(
        eq(asistenteLog.chatId, chatId),
        eq(asistenteLog.negocioId, negocio.negocioId),
        eq(asistenteLog.accion, "alta_producto"),
        eq(asistenteLog.pendiente, true),
      ),
    )
    .orderBy(desc(asistenteLog.ts))
    .limit(1);

  if (!fila) return null;
  if (Date.now() - fila.ts.getTime() > CAMPO_PENDIENTE_TTL_MS) {
    await db.delete(asistenteLog).where(eq(asistenteLog.id, fila.id));
    return null;
  }
  return fila;
}

/** La fila de un alta por su id, comprobando que es de este negocio. */
async function filaAlta(logId: string, negocio: Negocio) {
  const [fila] = await db
    .select()
    .from(asistenteLog)
    .where(
      and(
        eq(asistenteLog.id, logId),
        eq(asistenteLog.negocioId, negocio.negocioId),
        eq(asistenteLog.accion, "alta_producto"),
        eq(asistenteLog.pendiente, true),
      ),
    )
    .limit(1);
  return fila ?? null;
}

/** Guarda el borrador y pide el siguiente dato. */
async function pedirPasoAlta(
  negocio: Negocio,
  chatId: string,
  logId: string,
  borrador: BorradorAlta,
): Promise<void> {
  await db
    .update(asistenteLog)
    .set({ despues: borrador as never })
    .where(eq(asistenteLog.id, logId));

  const cancelar: Boton[][] = [
    [{ text: "Cancelar", callback_data: `z:${logId}` }],
    [BTN_MENU],
  ];

  if (borrador.paso === "precio") {
    await enviarBotones(
      chatId,
      `¿Cuánto cuesta «${borrador.nombre}»? Escríbelo como quieres que salga —«200 CUP»— o toca «Sin precio».`,
      [
        [{ text: "Sin precio", callback_data: `a:omitir:${logId}` }],
        ...cancelar,
      ],
    );
    return;
  }

  /* La categoría se toca, no se escribe: son las que ya tiene la carta. Tocar
     una nueva es escribir su nombre, y también vale. */
  const categorias = A.categoriasDe(negocio.menu ?? []).filter(
    (c) => c.clave !== "",
  );
  const filas: Boton[][] = categorias.map((categoria, i) => [
    {
      text: A.recortarEtiqueta(categoria.nombre, 50),
      callback_data: `a:cat:${logId}:${i}`,
    },
  ]);
  filas.push([{ text: "Sin categoría", callback_data: `a:cat:${logId}:-1` }]);
  filas.push(...cancelar);

  await enviarBotones(
    chatId,
    `¿En qué categoría va «${borrador.nombre}»? Toca una, o escribe el nombre de una nueva.`,
    filas,
  );
}

/** Crea el producto con lo recogido y cierra el alta. */
async function cerrarAlta(
  negocio: Negocio,
  chatId: string,
  logId: string,
  borrador: BorradorAlta,
  categoria: string,
): Promise<void> {
  const res = await ejecutarAgregarProductos(negocio, [
    {
      nombre: borrador.nombre ?? "",
      descripcion: "",
      precio: borrador.precio ?? "",
      moneda: "",
      categoria,
      etiqueta: "",
    },
  ]);

  if (!res.ok) {
    await db.delete(asistenteLog).where(eq(asistenteLog.id, logId));
    await enviarBotones(chatId, res.texto, [
      [{ text: "Empezar de nuevo", callback_data: "a" }],
      [BTN_MENU],
    ]);
    return;
  }

  /* La fila pasa de «alta a medias» a «alta hecha», con el antes y el después de
     verdad: es lo que lee el Deshacer. */
  await db
    .update(asistenteLog)
    .set({
      accion: "agregar_productos",
      antes: res.antes as never,
      despues: res.despues as never,
      pendiente: false,
    })
    .where(eq(asistenteLog.id, logId));

  await enviarBotones(chatId, res.texto, [
    [{ text: "Añadir otro", callback_data: "a" }],
    [{ text: "Ver mi catálogo", callback_data: "cmd:catalogo" }],
    [{ text: "Deshacer", callback_data: `u:${logId}` }],
    [BTN_MENU],
  ]);
}

/** La puerta de añadir productos: guiada con botones o pegando una lista, a
 * elección. Antes solo existía la plantilla, y quien quería añadir uno tenía que
 * escribirla entera. */
async function enviarMenuAlta(chatId: string): Promise<void> {
  await enviarBotones(chatId, "¿Cómo quieres añadir productos?", [
    [{ text: "Uno a paso, con botones", callback_data: "a" }],
    [{ text: "Varios de una vez, pegando una lista", callback_data: "a:p" }],
    [BTN_MENU],
  ]);
}

/** Arranca el alta guiada: borra lo que hubiera a medias y pide el nombre. */
async function iniciarAlta(negocio: Negocio, chatId: string): Promise<void> {
  if (!permite(negocio, "catalogo")) {
    await enviarBotones(
      chatId,
      "El dueño no te dio permiso para cambiar el catálogo.",
      soloMenu(),
    );
    return;
  }

  await limpiarCampoPendiente(chatId);

  const logId = await registrarLog({
    negocioId: negocio.negocioId,
    chatId,
    mensaje: null,
    accion: "alta_producto",
    antes: null,
    despues: { paso: "nombre" },
    via: "comando",
    pendiente: true,
  });

  if (!logId) {
    await enviarBotones(
      chatId,
      "No pude dejar el alta preparada. Prueba otra vez.",
      soloMenu(),
    );
    return;
  }

  await enviarBotones(chatId, "Escribe el nombre del producto nuevo:", [
    [{ text: "Cancelar", callback_data: `z:${logId}` }],
    [BTN_MENU],
  ]);
}

/**
 * ¿El mensaje es un dato del alta guiada?
 *
 * Devuelve `true` cuando lo consumió —avanzó de paso o creó el producto— y
 * `false` cuando no había alta esperando y el mensaje sigue su camino normal.
 */
async function manejarAltaPendiente(
  negocio: Negocio,
  update: A.ParsedTelegram,
): Promise<boolean> {
  const fila = await altaPendiente(negocio, update.chat_id);
  if (!fila) return false;

  const borrador = (fila.despues ?? { paso: "nombre" }) as BorradorAlta;

  if (borrador.paso === "nombre") {
    const nombre = A.limpiarCampo("name", update.texto);
    if (!nombre) {
      await enviarBotones(
        update.chat_id,
        "El nombre no puede quedar vacío. Escribe otro, o toca «Cancelar».",
        [
          [{ text: "Cancelar", callback_data: `z:${fila.id}` }],
          [BTN_MENU],
        ],
      );
      return true;
    }
    await pedirPasoAlta(negocio, update.chat_id, fila.id, {
      paso: "precio",
      nombre,
    });
    return true;
  }

  if (borrador.paso === "precio") {
    await pedirPasoAlta(negocio, update.chat_id, fila.id, {
      paso: "categoria",
      nombre: borrador.nombre,
      precio: A.limpiarCampo("price", update.texto),
    });
    return true;
  }

  await cerrarAlta(
    negocio,
    update.chat_id,
    fila.id,
    borrador,
    A.limpiarCampo("category", update.texto),
  );
  return true;
}

/**
 * ¿El mensaje es el valor de un campo que se estaba esperando?
 *
 * Devuelve `true` cuando lo consumió —aplicado o rechazado con una frase—, y
 * `false` cuando no había nada esperando y el mensaje sigue su camino normal.
 *
 * La fila nace `campo_producto` y se reescribe como `editar_producto` al
 * aplicarse: así el Deshacer la trata como cualquier otra edición, con su estado
 * anterior y su producto.
 */
async function manejarCampoPendiente(
  negocio: Negocio,
  update: A.ParsedTelegram,
): Promise<boolean> {
  const fila = await campoPendiente(negocio, update.chat_id);
  if (!fila) return false;

  const guardado = (fila.despues ?? {}) as {
    productoId?: string;
    campo?: string;
  };
  const campo = A.campoDeCodigo(guardado.campo ?? "");
  const productoId = guardado.productoId ?? "";
  const indice = indicePorId(negocio, productoId);

  if (!campo || indice === -1) {
    await db.delete(asistenteLog).where(eq(asistenteLog.id, fila.id));
    await enviarBotones(
      update.chat_id,
      "Ese producto ya no está en tu carta. Abre /catalogo y elige otro.",
      soloMenu(),
    );
    return true;
  }

  const valor = A.limpiarCampo(campo.clave, update.texto);
  if (campo.clave === "name" && !valor) {
    await enviarBotones(
      update.chat_id,
      "El nombre no puede quedar vacío. Escribe otro, o toca «Cancelar» en el mensaje anterior.",
      soloMenu(),
    );
    return true;
  }

  const cambios: Parameters<typeof ejecutarEditarProducto>[2] = {};
  cambios[campo.clave] = valor;

  const res = await ejecutarEditarProducto(negocio, indice, cambios);
  if (!res || !res.ok) {
    await db.delete(asistenteLog).where(eq(asistenteLog.id, fila.id));
    await enviarBotones(
      update.chat_id,
      res?.texto ?? "Ese producto ya no está en tu carta.",
      soloMenu(),
    );
    return true;
  }

  await db
    .update(asistenteLog)
    .set({
      accion: "editar_producto",
      mensaje: update.texto,
      antes: res.antes as never,
      despues: res.despues as never,
      pendiente: false,
    })
    .where(eq(asistenteLog.id, fila.id));

  const recargado = (await cargarNegocio(update.chat_id)) ?? negocio;
  const indiceNuevo = indicePorId(recargado, productoId);
  const item =
    indiceNuevo === -1 ? undefined : recargado.menu?.[indiceNuevo];
  const ficha = item
    ? `\n\n${A.textoFichaProducto(item, estaAgotado(item, Date.now()))}`
    : "";

  const filas: Boton[][] = [];
  if (item) filas.push([{ text: "Ver opciones", callback_data: `i:${productoId}` }]);
  filas.push([{ text: "Deshacer", callback_data: `u:${fila.id}` }]);

  await enviarBotones(update.chat_id, `${res.texto}${ficha}`, filas);
  return true;
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

  /* La lista de la plantilla se lee aquí, sin modelo: es gratis y no adivina.
     Va antes que cualquier intención para que un mensaje con varios productos
     no acabe en la IA —ni en su cuota—. */
  const nuevos = A.parsearProductos(update.texto);
  if (nuevos) {
    const res = await ejecutarAgregarProductos(negocio, nuevos);
    await aplicarResultadoDirecto(negocio, chatId, update.texto, res, "regex");
    return;
  }
  if (update.texto.includes("|")) {
    /* Traía barras pero no se pudo leer: casi seguro que copió la plantilla
       entera o se saltó una línea. Mejor repetir el formato que pagar al
       modelo por adivinar. */
    await enviarBotones(
      chatId,
      "No pude leer esa lista. Cada producto tiene que ir en una línea, con los datos separados por «|».\n\n" +
        A.plantillaProductos(),
      soloMenu(),
    );
    return;
  }

  const intencion = A.intencionDeTexto(update.texto);
  if (intencion) {
    if (intencion.tipo === "nuevo_producto") {
      await enviarMenuAlta(chatId);
      return;
    }

    /* «se acabó» a secas: el dueño sabe qué se acabó y no lo escribió. La
       respuesta útil es la lista con botones, y esa ya existe. */
    if (intencion.tipo === "disponibilidad" && !intencion.producto) {
      await enviarPaginaProductos(negocio, chatId, intencion.estado, 0);
      return;
    }

    const productos = productosDe(negocio.menu);

    /* El borrado se resuelve por nombre contra la carta real. Si no hay un
       candidato claro —o dudoso— sigue al modelo, que también sabe borrar. */
    if (intencion.tipo === "eliminar_producto") {
      const busqueda = A.buscarProducto(intencion.producto, productos);
      if (busqueda.nivel === "claro" && busqueda.mejor) {
        await pedirConfirmacionEliminar({
          negocio,
          chatId,
          mensaje: update.texto,
          producto: busqueda.mejor.name,
          via: "regex",
        });
        return;
      }
      if (busqueda.nivel === "ambiguo") {
        await preguntarCual({
          negocio,
          chatId,
          mensaje: update.texto,
          frase: intencion.producto,
          accion: "eliminar_producto",
          propuesta: { producto: intencion.producto },
          candidatos: busqueda.lista,
          via: "regex",
        });
        return;
      }
    } else {
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
        await responderConDeshacer(chatId, res, logId);
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
  }

  await manejarConModelo(negocio, update);
}

/** Cierra una escritura que no pasó por el modelo: registra, contesta y, si
 * quedó aplicada, deja el botón de Deshacer. */
async function aplicarResultadoDirecto(
  negocio: Negocio,
  chatId: string,
  mensaje: string,
  res: Resultado,
  via: "regex",
): Promise<void> {
  const logId = await registrarLog({
    negocioId: negocio.negocioId,
    chatId,
    mensaje,
    accion: res.accion,
    antes: res.antes,
    despues: res.despues,
    via,
  });
  await responderConDeshacer(chatId, res, logId);
}

/** La respuesta de un cambio, con salida: Deshacer si quedó aplicado y el menú
 * siempre. Una pantalla sin botón obliga a subir a buscar el mensaje anterior. */
async function responderConDeshacer(
  chatId: string,
  res: Resultado,
  logId: string | null,
): Promise<void> {
  const filas: Boton[][] = [];
  if (res.ok && logId) {
    filas.push([{ text: "Deshacer", callback_data: `u:${logId}` }]);
  }
  filas.push([BTN_MENU]);
  await enviarBotones(chatId, res.texto, filas);
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

  /* Entender una frase libre es la capa que paga modelo, y es de Pro. En
     Esencial el bot sigue trabajando con comandos y botones, que cuestan cero. */
  if (!(await puede(negocio.negocioId, "asistente_ia"))) {
    await enviarBotones(
      chatId,
      "Para entenderte con frases libres hace falta el asistente con IA, que es del plan Pro. Con tu plan puedo actualizar tu carta con comandos y botones:",
      MENU,
    );
    return;
  }

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
    await enviarBotones(chatId, texto, accion === "ver_carta" ? MENU : soloMenu());
    return;
  }

  /* Las acciones que van contra un producto se resuelven aquí una sola vez, y el
     nivel decide el camino.

     Cuando el nombre sonaba a varios, el camino acababa en «no encontré ese
     producto», que es justo lo contrario de lo que hay que hacer: el dueño dijo
     «el café» y en su carta hay tres que empiezan así —el problema es del bot,
     no suyo—. Ahora se pregunta, con botones. */
  if (
    accion === "set_disponibilidad" ||
    accion === "set_precio" ||
    accion === "editar_producto" ||
    accion === "eliminar_producto"
  ) {
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

    if (busqueda.nivel === "claro" && busqueda.mejor) {
      /* Borrar es destructivo: se pregunta siempre, como el precio. Lo que se
         guarda es el nombre que hay en la carta, así que al pulsar «Sí» se
         vuelve a resolver solo. */
      if (accion === "eliminar_producto") {
        await pedirConfirmacionEliminar({
          negocio,
          chatId,
          mensaje: update.texto,
          producto: busqueda.mejor.name,
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
        accion === "set_precio" &&
        A.requiereConfirmacion(1, true) === "confirmar"
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
    await responderConDeshacer(chatId, res, null);
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
  await responderConDeshacer(chatId, res, logId);
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
    await enviarBotones(
      args.chatId,
      "No pude dejar el cambio preparado. Prueba otra vez.",
      soloMenu(),
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
    await enviarBotones(
      args.chatId,
      "No pude dejar el cambio preparado. Prueba otra vez.",
      soloMenu(),
    );
    return;
  }

  await enviarBotones(
    args.chatId,
    `Cambio «${args.producto}» a ${args.precio}.\n¿Lo aplico?`,
    botonesSiNo(logId),
  );
}

/** Deja el borrado esperando el «Sí»: quitar un producto no se deshace con un
 * toque si el dueño no lo esperaba, así que se pregunta antes. */
async function pedirConfirmacionEliminar(args: {
  negocio: Negocio;
  chatId: string;
  mensaje: string;
  producto: string;
  via: "comando" | "regex" | "llm";
  tokensIn?: number;
  tokensOut?: number;
}): Promise<void> {
  const logId = await registrarLog({
    negocioId: args.negocio.negocioId,
    chatId: args.chatId,
    mensaje: args.mensaje,
    accion: "eliminar_producto",
    antes: null,
    despues: { producto: args.producto },
    via: args.via,
    tokensIn: args.tokensIn,
    tokensOut: args.tokensOut,
    pendiente: true,
  });

  if (!logId) {
    await enviarBotones(
      args.chatId,
      "No pude dejar el cambio preparado. Prueba otra vez.",
      soloMenu(),
    );
    return;
  }

  await enviarBotones(
    args.chatId,
    `Voy a quitar «${args.producto}» de tu carta.\n¿Lo hago?`,
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

    case "agregar_productos": {
      const lista = Array.isArray(p.productos) ? p.productos : [];
      const texto = (valor: unknown, max: number) =>
        typeof valor === "string" ? valor.trim().slice(0, max) : "";
      const nuevos = lista
        .map((crudo) => {
          const o = (crudo ?? {}) as Record<string, unknown>;
          return {
            nombre: texto(o.nombre ?? o.name, 120),
            descripcion: texto(o.descripcion ?? o.description, 300),
            precio: texto(o.precio ?? o.price, 40),
            moneda: texto(o.moneda ?? o.currency, 10),
            categoria: texto(o.categoria ?? o.category, 60),
            etiqueta: texto(o.etiqueta ?? o.tag, 20),
          };
        })
        .filter((nuevo) => nuevo.nombre);
      if (nuevos.length === 0) return null;
      return ejecutarAgregarProductos(negocio, nuevos);
    }

    case "editar_producto": {
      const indice = resolver(p.producto);
      if (indice === null) return null;

      /* Solo se cambia lo que llegó: `undefined` es «no lo menciones», cadena
         vacía es «déjalo vacío». El nombre vacío se ignora, que un producto sin
         nombre no se puede enseñar. */
      const campo = (claves: string[], max: number): string | undefined => {
        for (const clave of claves) {
          const valor = p[clave];
          if (typeof valor === "string") return valor.trim().slice(0, max);
        }
        return undefined;
      };
      const cambios: Parameters<typeof ejecutarEditarProducto>[2] = {};
      const nombre = campo(["nombre", "name"], 120);
      if (nombre) cambios.name = nombre;
      const descripcion = campo(["descripcion", "description"], 300);
      if (descripcion !== undefined) cambios.description = descripcion;
      const precio = campo(["precio", "price"], 40);
      if (precio !== undefined) cambios.price = precio;
      const moneda = campo(["moneda", "currency"], 10);
      if (moneda !== undefined) cambios.currency = moneda;
      const categoria = campo(["categoria", "category"], 60);
      if (categoria !== undefined) cambios.category = categoria;
      const etiqueta = campo(["etiqueta", "tag"], 20);
      if (etiqueta !== undefined) cambios.tag = etiqueta;

      return ejecutarEditarProducto(negocio, indice, cambios);
    }

    case "eliminar_producto": {
      const indice = resolver(p.producto);
      if (indice === null) return null;
      return ejecutarEliminarProducto(negocio, indice);
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

  if (!permite(negocio, "telegram")) {
    await responderCallback(
      callbackId,
      "El dueño te quitó el acceso al asistente.",
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

    case "a": {
      /* El alta guiada: `a` arranca, `a:p` manda la plantilla, `a:omitir` salta
         el precio y `a:cat` elige la categoría de la fila que espera. */
      if (!permite(negocio, "catalogo")) {
        await responderCallback(
          callbackId,
          "El dueño no te dio permiso para cambiar el catálogo.",
          true,
        );
        return;
      }

      const pasoAlta = resto[0] ?? "";

      if (pasoAlta === "p") {
        await responderCallback(callbackId, "");
        await enviarBotones(chatId, A.plantillaProductos(), soloMenu());
        return;
      }

      if (pasoAlta === "omitir") {
        const fila = await filaAlta(resto[1] ?? "", negocio);
        if (!fila) {
          await responderCallback(callbackId, "Ese botón ya no vale.", true);
          return;
        }
        const borrador = (fila.despues ?? {}) as BorradorAlta;
        await responderCallback(callbackId, "");
        await pedirPasoAlta(negocio, chatId, fila.id, {
          paso: "categoria",
          nombre: borrador.nombre,
          precio: "",
        });
        return;
      }

      if (pasoAlta === "cat") {
        const fila = await filaAlta(resto[1] ?? "", negocio);
        if (!fila) {
          await responderCallback(callbackId, "Ese botón ya no vale.", true);
          return;
        }
        const borrador = (fila.despues ?? {}) as BorradorAlta;
        const indiceCategoria = Number.parseInt(resto[2] ?? "-1", 10);
        const categorias = A.categoriasDe(negocio.menu ?? []).filter(
          (c) => c.clave !== "",
        );
        const categoria =
          Number.isInteger(indiceCategoria) && indiceCategoria >= 0
            ? (categorias[indiceCategoria]?.nombre ?? "")
            : "";
        await responderCallback(callbackId, "");
        await cerrarAlta(negocio, chatId, fila.id, borrador, categoria);
        return;
      }

      await responderCallback(callbackId, "");
      await iniciarAlta(negocio, chatId);
      return;
    }

    case "l": {
      /* Las categorías del catálogo. Paginar no escribe: solo se reescribe el
         mensaje. */
      const desde = Math.max(0, Number.parseInt(resto[0] ?? "0", 10) || 0);
      await responderCallback(callbackId, "");
      await enviarCategoriasCatalogo(
        negocio,
        chatId,
        desde,
        update.callback_mensaje_id,
      );
      return;
    }

    case "g": {
      /* Los productos de una categoría del catálogo. */
      const categoria = Math.max(0, Number.parseInt(resto[0] ?? "0", 10) || 0);
      const desde = Math.max(0, Number.parseInt(resto[1] ?? "0", 10) || 0);
      await responderCallback(callbackId, "");
      await enviarProductosCategoria(
        negocio,
        chatId,
        categoria,
        desde,
        update.callback_mensaje_id,
      );
      return;
    }

    case "m": {
      /* Volver al menú. Manda un mensaje nuevo: el anterior se queda como estaba
         y siempre hay un camino de vuelta. */
      await responderCallback(callbackId, "");
      await enviarBotones(chatId, "¿Qué quieres hacer?", MENU);
      return;
    }

    case "i": {
      await responderCallback(callbackId, "");
      await enviarFichaProducto(
        negocio,
        chatId,
        resto[0] ?? "",
        update.callback_mensaje_id,
      );
      return;
    }

    case "f": {
      if (!permite(negocio, "catalogo")) {
        await responderCallback(
          callbackId,
          "El dueño no te dio permiso para cambiar el catálogo.",
          true,
        );
        return;
      }
      await responderCallback(callbackId, "");
      await pedirValorCampo(negocio, chatId, resto[0] ?? "", resto[1] ?? "");
      return;
    }

    case "t": {
      /* Agotado ↔ disponible en un solo toque: es el cambio más frecuente y no
         tiene sentido pedir que lo escriba. */
      const productoId = resto[0] ?? "";
      const indice = indicePorId(negocio, productoId);
      if (indice === -1) {
        await responderCallback(
          callbackId,
          "Ese producto ya no está en tu carta.",
          true,
        );
        return;
      }

      const estado: Disponibilidad = productoAgotado(negocio, indice)
        ? "disponible"
        : "agotado";
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

      await responderCallback(callbackId, res.texto, !res.ok);
      if (res.ok && update.callback_mensaje_id) {
        const recargado = (await cargarNegocio(chatId)) ?? negocio;
        await enviarFichaProducto(
          recargado,
          chatId,
          productoId,
          update.callback_mensaje_id,
          logId,
        );
      }
      return;
    }

    case "x": {
      if (!permite(negocio, "catalogo")) {
        await responderCallback(
          callbackId,
          "El dueño no te dio permiso para cambiar el catálogo.",
          true,
        );
        return;
      }
      const indice = indicePorId(negocio, resto[0] ?? "");
      const item = indice === -1 ? undefined : negocio.menu?.[indice];
      if (!item) {
        await responderCallback(
          callbackId,
          "Ese producto ya no está en tu carta.",
          true,
        );
        return;
      }
      await responderCallback(callbackId, "");
      /* Quitar se pregunta siempre: es el único gesto del catálogo que no se
         arregla con un botón si el dueño no lo esperaba. */
      await pedirConfirmacionEliminar({
        negocio,
        chatId,
        mensaje: "",
        producto: item.name,
        via: "comando",
      });
      return;
    }

    case "z": {
      /* Cancelar la espera de un valor: se borra la fila y se acaba —con la
         puerta de vuelta al producto si se sabe cuál era—. */
      const logId = resto[0] ?? "";
      const [fila] = await db
        .select()
        .from(asistenteLog)
        .where(eq(asistenteLog.id, logId))
        .limit(1);
      await db.delete(asistenteLog).where(eq(asistenteLog.id, logId));

      const productoId = (fila?.despues as { productoId?: string } | null)
        ?.productoId;
      const filas: Boton[][] = productoId
        ? [[{ text: "← Volver al producto", callback_data: `i:${productoId}` }]]
        : [];
      filas.push([BTN_MENU]);

      await responderCallback(callbackId, "Cancelado.");
      if (update.callback_mensaje_id) {
        await editarTexto(
          chatId,
          update.callback_mensaje_id,
          "Cancelado. No cambié nada.",
          filas,
        );
      }
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
      filas.push([BTN_MENU]);
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
        const filas: Boton[][] = [];
        if (logId) {
          filas.push([{ text: "Deshacer", callback_data: `u:${logId}` }]);
        }
        filas.push([BTN_MENU]);
        await editarTexto(
          chatId,
          update.callback_mensaje_id,
          res.texto,
          filas,
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
        /* El menú siempre detrás: una pregunta que se queda sin salida obliga a
           subir a buscar el mensaje anterior. */
        const filas = [...(elegido.botones ?? []), [BTN_MENU]];
        await editarTexto(
          chatId,
          update.callback_mensaje_id,
          elegido.texto,
          filas,
        );
      }
      return;
    }

    case "u": {
      const texto = await deshacer(resto[0] ?? "", negocio);
      await responderCallback(callbackId, texto);
      if (update.callback_mensaje_id) {
        await editarTexto(
          chatId,
          update.callback_mensaje_id,
          texto,
          soloMenu(),
        );
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
          soloMenu(),
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
        const filas: Boton[][] = [];
        if (aplicado.logId) {
          filas.push([
            { text: "Deshacer", callback_data: `u:${aplicado.logId}` },
          ]);
        }
        filas.push([BTN_MENU]);
        await editarTexto(
          chatId,
          update.callback_mensaje_id,
          aplicado.texto,
          filas,
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

  /* Elegir el candidato no es confirmar el borrado: después de «¿a cuál?»
     todavía falta el «¿lo hago?», como en el camino sin ambigüedad. */
  if (fila.accion === "eliminar_producto") {
    return {
      aviso: "",
      alerta: false,
      texto: `Voy a quitar «${producto.name}» de tu carta.\n¿Lo hago?`,
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
