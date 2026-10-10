import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AVISOS_POR_SEMANA,
  avisosPorCambios,
  avisosRestantes,
  configSeguidores,
  deepLinkTelegram,
  esBaja,
  lotes,
  MAX_TEXTO,
  MAX_TITULO,
  mensajeAviso,
  negocioDeStart,
  semanaDelAviso,
  validarAviso,
} from "./seguidores";

test("el enlace lleva al bot con el negocio detrás", () => {
  assert.equal(
    deepLinkTelegram("LaVerdeBot", "cafeteria-la-ceiba"),
    "https://t.me/LaVerdeBot?start=seg_cafeteria-la-ceiba",
  );
  /* El `@` de la arroba no va en una URL, y sin bot o sin negocio no hay enlace
     a medias: mejor ninguno que uno que abra la conversación equivocada. */
  assert.equal(
    deepLinkTelegram("@LaVerdeBot", "x"),
    "https://t.me/LaVerdeBot?start=seg_x",
  );
  assert.equal(deepLinkTelegram("", "x"), "");
  assert.equal(deepLinkTelegram("LaVerdeBot", "  "), "");
});

test("el payload del /start se vuelve a leer igual que se escribió", () => {
  const id = "sabor-habanero";
  const payload = deepLinkTelegram("LaVerdeBot", id).split("start=")[1];
  assert.equal(negocioDeStart(payload), id);
  /* Sin prefijo, sin nada detrás o sin payload no hay negocio al que apuntar. */
  assert.equal(negocioDeStart("otro_cosa"), null);
  assert.equal(negocioDeStart("seg_"), null);
  assert.equal(negocioDeStart(undefined), null);
  assert.equal(negocioDeStart("  seg_  x  "), "x");
});

test("la baja se reconoce con y sin mención al bot", () => {
  assert.equal(esBaja("/baja"), true);
  assert.equal(esBaja("  /BAJA  "), true);
  assert.equal(esBaja("/baja@LaVerdeBot"), true);
  /* Los sinónimos que la gente escribe cuando quiere irse. */
  assert.equal(esBaja("/stop"), true);
  assert.equal(esBaja("/parar"), true);
  /* La palabra sola también vale —hay quien la escribe sin la barra—, pero la
     primera palabra de una frase no. */
  assert.equal(esBaja("baja"), true);
  assert.equal(esBaja("baja los precios"), false);
  assert.equal(esBaja("/start seg_x"), false);
  assert.equal(esBaja(undefined), false);
});

test("el aviso sale con titular, cuerpo, enlace y la salida de /baja", () => {
  const texto = mensajeAviso({
    negocio: "El Sabroso",
    titulo: "2x1 hasta las 9",
    texto: "La pizza familiar a mitad de precio.",
    url: "https://laverde.kynari.dev/place/abc",
  });
  assert.match(texto, /^📣 2x1 hasta las 9/);
  assert.match(texto, /El Sabroso en La Verde:\nhttps:\/\/laverde/);
  /* El `/baja` viaja **dentro** del mensaje: es la única salida de quien lo
     recibe, y por eso no puede depender de nada de fuera. */
  assert.match(texto, /Contesta \/baja si no quieres recibir más avisos\./);
});

test("el titular y el texto tienen que caber", () => {
  assert.equal(validarAviso("2x1", "La pizza a mitad de precio."), null);
  assert.equal(validarAviso("  ", "algo"), "El aviso necesita un titular.");
  assert.equal(validarAviso("2x1", "   "), "El aviso necesita un texto.");
  assert.match(validarAviso("x".repeat(MAX_TITULO + 1), "algo") ?? "", /titular/);
  assert.match(validarAviso("2x1", "x".repeat(MAX_TEXTO + 1)) ?? "", /caracteres/);
});

test("el tope son tres avisos por semana y negocio", () => {
  assert.equal(AVISOS_POR_SEMANA, 3);
  assert.equal(avisosRestantes(0), 3);
  assert.equal(avisosRestantes(2), 1);
  assert.equal(avisosRestantes(3), 0);
  /* Un contador que se pasó no da negativos: dice que no queda nada. */
  assert.equal(avisosRestantes(9), 0);
  /* La clave del tope es la semana ISO, la misma que la de las publicaciones. */
  assert.match(semanaDelAviso(new Date("2026-10-08T12:00:00Z")), /^2026-W41$/);
  assert.equal(semanaDelAviso(new Date("2026-10-12T12:00:00Z")), "2026-W42");
});

test("el reparto en lotes respeta el tamaño y no pierde a nadie", () => {
  assert.deepEqual(lotes([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  /* El último lote va corto y el vacío no existe. */
  assert.deepEqual(lotes([1, 2, 3], 3), [[1, 2, 3]]);
  assert.deepEqual(lotes([], 2), []);
  /* Un tamaño imposible —0 o negativo— no puede colgar el recorrido: se manda
     todo de una vez. */
  assert.deepEqual(lotes([1, 2], 0), [[1, 2]]);
  assert.deepEqual(lotes([1, 2], -3), [[1, 2]]);
});

test("lo que avisa un guardado: la oferta, el producto y la reapertura", () => {
  const nada = avisosPorCambios({
    negocio: "El Sabroso",
    ofertasNuevas: [],
    productosNuevos: [],
    reabre: false,
  });
  /* Guardar el horario, las fotos o el teléfono no avisa a nadie. */
  assert.deepEqual(nada, []);

  const todo = avisosPorCambios({
    negocio: "El Sabroso",
    ofertasNuevas: [{ titulo: "2x1", descripcion: "Hasta las 9." }],
    productosNuevos: ["Tarta de chocolate", "Flan"],
    reabre: true,
  });
  assert.equal(todo.length, 3);
  assert.equal(todo[0]?.titulo, "2x1");
  assert.equal(todo[0]?.texto, "Hasta las 9.");
  assert.equal(todo[1]?.titulo, "Nuevo en la carta de El Sabroso");
  assert.equal(todo[1]?.texto, "Acabamos de añadir Tarta de chocolate y Flan.");
  assert.match(todo[2]?.titulo ?? "", /ha vuelto a abrir/);
});

test("varias ofertas a la vez son un aviso, no tres", () => {
  const [unico, ...resto] = avisosPorCambios({
    negocio: "El Sabroso",
    ofertasNuevas: [{ titulo: "2x1" }, { titulo: "Café a 50" }],
    productosNuevos: [],
    reabre: false,
  });
  assert.equal(resto.length, 0);
  assert.equal(unico?.titulo, "Ofertas nuevas en El Sabroso");
  assert.match(unico?.texto ?? "", /«2x1» y «Café a 50»/);
});

test("una lista larga de productos se recorta y lo dice", () => {
  const [aviso] = avisosPorCambios({
    negocio: "El Sabroso",
    ofertasNuevas: [],
    productosNuevos: ["a", "b", "c", "d", "e", "f", "g"],
    reabre: false,
  });
  assert.match(aviso?.texto ?? "", /y 2 más\.$/);
  /* Los cinco nombres que sí salen, con la coma y el «y» del último. */
  assert.match(aviso?.texto ?? "", /a, b, c, d y e/);
});

test("sin enlace no hay botón, aunque el negocio tenga nombre", () => {
  assert.equal(configSeguidores({ name: "El Sabroso" }), undefined);
  assert.equal(
    configSeguidores({ name: "El Sabroso", enlaceSeguidores: "   " }),
    undefined,
  );
  assert.equal(
    configSeguidores({ name: "  ", enlaceSeguidores: "https://t.me/x?start=seg_1" }),
    undefined,
  );
  assert.deepEqual(
    configSeguidores({
      name: "El Sabroso",
      enlaceSeguidores: "https://t.me/x?start=seg_1",
    }),
    { negocio: "El Sabroso", enlace: "https://t.me/x?start=seg_1" },
  );
});
