import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buscarProducto,
  enlaceVinculacion,
  esComandoValido,
  generarCodigo,
  ignorarComandoExterno,
  intencionDeTexto,
  leerTelegramUpdate,
  parseComando,
  promptParaLLM,
  promptSistema,
  requiereConfirmacion,
  similitudJaccard,
  similitudProducto,
  textoCarta,
  CARTA_MAX_CHARS,
  HERRAMIENTAS_IA,
} from "./asistente";

/* ── helpers ─────────────────────────────────────────────────────── */
function rawMensaje(texto: string, chatTipo?: "private" | "group" | "supergroup" | "channel") {
  return {
    update_id: 1,
    message: {
      message_id: 10,
      text: texto,
      chat: { id: 12345678, type: chatTipo },
    },
  } as const;
}

function rawCallback(data: string, chatTipo?: "private" | "group" | "supergroup" | "channel") {
  return {
    update_id: 2,
    callback_query: {
      id: "cba_1",
      data,
      message: { message_id: 11, chat: { id: 12345678, type: chatTipo } },
    },
  } as const;
}

/* ── leerTelegramUpdate ─────────────────────────────────────────── */
test("solo chats privados pasan", () => {
  assert.ok(leerTelegramUpdate(rawMensaje("hola")));
  assert.equal(leerTelegramUpdate(rawMensaje("hola", "group")), null);
  assert.equal(leerTelegramUpdate(rawMensaje("hola", "supergroup")), null);
  assert.equal(leerTelegramUpdate(rawMensaje("hola", "channel")), null);
  assert.equal(leerTelegramUpdate(rawMensaje("hola", "pública" as "private" | "group" | "supergroup" | "channel")), null);
});

test("mensajes sin texto se ignoran", () => {
  assert.equal(
    leerTelegramUpdate({
      update_id: 9,
      message: { message_id: 1, chat: { id: 1, type: "private" } },
    }),
    null,
  );
});

test("mensajes > 500 caracteres se ignoran", () => {
  assert.ok(leerTelegramUpdate(rawMensaje("x".repeat(500))));
  assert.equal(leerTelegramUpdate(rawMensaje("x".repeat(501))), null);
});

test("los callbacks de botón inline pasan y se normalizan", () => {
  const cb = leerTelegramUpdate(rawCallback("agotado_3"));
  assert.ok(cb);
  assert.equal(cb.chat_tipo, "private");
  assert.equal(cb.chat_id, "12345678");
  assert.equal(cb.callback_data, "agotado_3");
  assert.equal(cb.callback_query_id, "cba_1");
  assert.equal(cb.texto, "");
});

// tests con chat_tipo explícito group/supergroup/channel
test("mensajes de grupos se ignoran", () => {
  assert.equal(leerTelegramUpdate(rawMensaje("hola", "group")), null);
  assert.equal(leerTelegramUpdate(rawMensaje("hola", "supergroup")), null);
  assert.equal(leerTelegramUpdate(rawMensaje("hola", "channel")), null);
});

test("callback de grupo se ignora", () => {
  assert.equal(leerTelegramUpdate(rawCallback("x", "group")), null);
});

test("callback sin data se ignora", () => {
  assert.equal(
    leerTelegramUpdate({
      update_id: 5,
      callback_query: { id: "x", data: "", message: { message_id: 1, chat: { id: 1, type: "private" } } },
    }),
    null,
  );
});

/* ── parseComando ───────────────────────────────────────────────── */
test("solo texto que empiece por / tiene comando", () => {
  assert.deepEqual(parseComando("/agotado"), { comando: "agotado", resto: "" });
  assert.deepEqual(parseComando("/agotado pan"), { comando: "agotado", resto: "pan" });
  assert.deepEqual(parseComando("/agotado  pan "), { comando: "agotado", resto: "pan" });
  assert.equal(parseComando("agotado pan"), null);
  assert.equal(parseComando(""), null);
  assert.equal(parseComando("  "), null);
});

test("una mención al bot se quita del comando", () => {
  assert.deepEqual(parseComando("/start@LaVerdeBot"), { comando: "start", resto: "" });
  assert.deepEqual(parseComando("/agotado@LaVerdeBot pan"), { comando: "agotado", resto: "pan" });
});

test("los comandos que existen son reconocidos", () => {
  assert.equal(esComandoValido("agotado"), true);
  assert.equal(esComandoValido("disponible"), true);
  assert.equal(esComandoValido("abrir"), true);
  assert.equal(esComandoValido("cerrar"), true);
  assert.equal(esComandoValido("stats"), true);
  assert.equal(esComandoValido("carta"), true);
  assert.equal(esComandoValido("ayuda"), true);
  assert.equal(esComandoValido("help"), true);
  assert.equal(esComandoValido("mirar"), false);
});

test("los comandos externos se marcan para ignorar", () => {
  assert.equal(ignorarComandoExterno("yikes"), true);
  /* `help` es de todo bot, pero también lo teclea quien quiere ayuda: se atiende
     igual que `/ayuda` en vez de desviarse. */
  assert.equal(ignorarComandoExterno("help"), false);
  assert.equal(ignorarComandoExterno("set_webhook"), false);
});

/* ── intencionDeTexto ────────────────────────────────────────────── */
test("detecta patrones simples de disponibilidad", () => {
  assert.deepEqual(intencionDeTexto("se acabó el pan"), { estado: "agotado", producto: "el pan" });
  assert.deepEqual(intencionDeTexto("te acabó la pizza"), { estado: "agotado", producto: "la pizza" });
  assert.deepEqual(intencionDeTexto("se acabó Spinach"), { estado: "agotado", producto: "Spinach" });
  assert.deepEqual(intencionDeTexto("Agotado el café"), { estado: "agotado", producto: "el café" });
  assert.deepEqual(intencionDeTexto("agotadas las bebidas"), { estado: "agotado", producto: "las bebidas" });
  assert.deepEqual(intencionDeTexto("ya hay donas"), { estado: "disponible", producto: "donas" });
  assert.deepEqual(intencionDeTexto("hay empanadas"), { estado: "disponible", producto: "empanadas" });

  // También detecta los acortamientos de "agotado" sin producto.
  assert.deepEqual(intencionDeTexto("Agotado"), null);
  assert.deepEqual(intencionDeTexto("agotado"), null);
});

test("textos que no calzan devuelven null", () => {
  assert.equal(intencionDeTexto("hola"), null);
  assert.equal(intencionDeTexto("ano"), null); // enfermedad
  assert.equal(intencionDeTexto(""), null);
  assert.equal(intencionDeTexto("  "), null);
});

/* ── similitud difusa ───────────────────────────────────────────── */
test("similitudJaccard devuelve 0 entre cadenas sin trigramas", () => {
  assert.equal(similitudJaccard("", "x"), 0);
  assert.equal(similitudJaccard("a", "b"), 0);
});

test("similitudJaccard da 1 entre idénticas", () => {
  assert.equal(similitudJaccard("pan", "pan"), 1);
  assert.equal(similitudJaccard("  PAN  ", "pan"), 1);
});

test("similitudJaccard da algo razonable entre cercanas", () => {
  assert.ok(similitudJaccard("café", "cafet") > 0.4);
});

/* Jaccard solo no llega: «arroz» contra «arroz con» comparte tres trigramas de
   siete y da 0,43. La similitud que empareja la carta —`similitudProducto`—
   mezcla la contención y por eso sí lo da. */
test("similitudProducto premia que una cadena contenga a la otra", () => {
  assert.ok(similitudProducto("café", "cafet") > 0.4);
  assert.ok(similitudProducto("arroz", "arroz con") > 0.6);
  assert.equal(similitudProducto("pan", "pan"), 1);
  assert.equal(similitudProducto("pan", "máquina de coser"), 0);
});

test("buscarProducto elige el claro cuando hay uno inequívoco", () => {
  const lista = [
    { id: "1", name: "Café de especialidad" },
    { id: "2", name: "Torta de chocolate" },
    { id: "3", name: "Capuccino" },
  ];
  const r = buscarProducto("café", lista);
  assert.equal(r.nivel, "claro");
  assert.ok(r.mejor);
  assert.equal(r.mejor.name, "Café de especialidad");
});

test("buscarProducto reporta ambiguo cuando hay varios parecidos", () => {
  const lista = [
    { id: "1", name: "Café" },
    { id: "2", name: "Cafetín" },
    { id: "3", name: "Café de mañana" },
  ];
  const r = buscarProducto("cafe", lista);
  assert.equal(r.nivel, "ambiguo");
  assert.equal(r.mejor, null);
});

test("buscarProducto devuelve ninguno si nada encaja", () => {
  const r = buscarProducto("máquina de coser", [
    { id: "1", name: "Café" },
    { id: "2", name: "Tostada" },
  ]);
  assert.equal(r.nivel, "ninguno");
  assert.equal(r.mejor, null);
});

test("buscarProducto funciona con lista vacía", () => {
  const r = buscarProducto("cualquiera", []);
  assert.equal(r.nivel, "ninguno");
  assert.equal(r.mejor, null);
  assert.deepEqual(r.lista, []);
});

/* ── requiereConfirmacion ───────────────────────────────────────── */
test("no pide confirmación para cambios pequeños sin precios", () => {
  assert.equal(requiereConfirmacion(1, false), "auto");
  assert.equal(requiereConfirmacion(2, false), "auto");
  assert.equal(requiereConfirmacion(0, false), "auto");
});

test("pide confirmación si afecta a muchos productos o a precio/horario", () => {
  assert.equal(requiereConfirmacion(3, false), "confirmar");
  assert.equal(requiereConfirmacion(5, false), "confirmar");
  assert.equal(requiereConfirmacion(1, true), "confirmar");
  assert.equal(requiereConfirmacion(0, true), "confirmar");
});

/* ── prompt de sistema ──────────────────────────────────────────── */
test("el prompt de sistema es corto", () => {
  const sistema = promptSistema();
  assert.ok(sistema.length > 0);
  assert.ok(sistema.length <= 400, `prompt demasiado largo: ${sistema.length}`);
});

test("promptParaLLM devuelve system y, si aplica, cache_control", () => {
  const con = promptParaLLM(true);
  assert.equal(typeof con.system, "string");
  assert.ok(con.system.length > 0);
  assert.ok("cache_control" in con);
  assert.deepEqual(con.cache_control, { type: "ephemeral" });

  const sin = promptParaLLM(false);
  assert.equal(typeof sin.system, "string");
  assert.equal("cache_control" in sin, false);
});

test("las herramientas están definidas con nombres coherentes", () => {
  const nombres = new Set(HERRAMIENTAS_IA.map((h) => h.name));
  assert.equal(nombres.has("set_disponibilidad"), true);
  assert.equal(nombres.has("set_precio"), true);
  assert.equal(nombres.has("set_horario"), true);
  assert.equal(nombres.has("abrir_cerrar_hoy"), true);
  assert.equal(nombres.has("consultar_stats"), true);
  assert.equal(nombres.has("ver_carta"), true);
  assert.equal(nombres.size, 6);
});

/* ── la carta contada ───────────────────────────────────────────── */
test("textoCarta lista nombre, precio y estado, uno por línea", () => {
  const texto = textoCarta(
    [
      { name: "Pan de queso", price: "25", currency: "CUP" },
      {
        name: "Café de especialidad",
        price: "150",
        currency: "CUP",
        disponibilidad: "agotado",
        agotadoHasta: null,
      },
      { name: "Sin precio" },
    ],
    1_000,
  );
  assert.match(texto, /1\. Pan de queso — 25 CUP/);
  assert.match(texto, /2\. Café de especialidad — 150 CUP · agotado/);
  assert.match(texto, /3\. Sin precio/);
});

test("textoCarta respeta el fin del agotado", () => {
  const item = { name: "Pan", price: "25", currency: "CUP", disponibilidad: "agotado" as const };
  assert.match(textoCarta([{ ...item, agotadoHasta: 2_000 }], 1_000), /agotado/);
  /* La fecha ya pasó: vuelve solo a estar disponible. */
  assert.doesNotMatch(textoCarta([{ ...item, agotadoHasta: 500 }], 1_000), /agotado/);
});

test("textoCarta dice cuándo la carta está vacía", () => {
  assert.match(textoCarta([]), /todavía no tiene productos/i);
});

test("textoCarta nunca se pasa del tope de Telegram", () => {
  const larga = Array.from({ length: 200 }, (_, i) => ({
    name: `Producto ${i}`,
    price: "10",
    currency: "CUP",
    description: "x".repeat(200),
  }));
  const texto = textoCarta(larga, 1_000);
  assert.ok(
    texto.length <= Math.max(CARTA_MAX_CHARS, 4096),
    `demasiado largo: ${texto.length}`,
  );
  assert.match(texto, /más\./);
});

/* ── código de vinculación ──────────────────────────────────────── */
test("el enlace de vinculación lleva el código sin el prefijo de seguidores", () => {
  const enlace = enlaceVinculacion("@laverde_bot", "AA7K2M");
  assert.equal(enlace, "https://t.me/laverde_bot?start=AA7K2M");
  /* Con `seg_` delante, `negocioDeStart` lo desviaría al alta de seguidores. */
  assert.ok(!enlace!.includes("seg_"));
  assert.equal(enlaceVinculacion("", "AA7K2M"), null);
  assert.equal(enlaceVinculacion("bot", ""), null);
});

test("el código de vinculación tiene el largo pedido y solo usa su alfabeto", () => {
  for (let i = 0; i < 200; i++) {
    const codigo = generarCodigo();
    assert.equal(codigo.length, 6);
    /* Sin las cuatro que se confunden al teclearlas en el móvil. */
    assert.match(codigo, /^[A-HJ-NP-Z2-9]+$/);
  }
});
