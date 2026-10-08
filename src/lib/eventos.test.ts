import assert from "node:assert/strict";
import { test } from "node:test";
import { LARGO_MAX, esTipoEvento, parsearEvento } from "./eventos";

/**
 * La validación del beacon es la frontera por donde entra tráfico sin sesión,
 * así que es lo que más conviene tener clavado: si esto se afloja, cualquiera
 * escribe en las estadísticas de un negocio ajeno.
 */

test("un evento del cliente se acepta y se normaliza", () => {
  assert.deepEqual(parsearEvento({ negocioId: "  abc ", tipo: "vista_menu" }), {
    negocioId: "abc",
    tipo: "vista_menu",
    dimension: "",
  });

  assert.deepEqual(
    parsearEvento({
      negocioId: "abc",
      tipo: "producto_visto",
      dimension: "  Arroz con pollo  ",
    }),
    { negocioId: "abc", tipo: "producto_visto", dimension: "Arroz con pollo" },
  );
});

test("un tipo fuera del catálogo no se cuenta", () => {
  assert.equal(parsearEvento({ negocioId: "abc", tipo: "delete_all" }), null);
  assert.equal(parsearEvento({ negocioId: "abc", tipo: 7 }), null);
  assert.equal(parsearEvento({ negocioId: "abc" }), null);
  assert.equal(esTipoEvento("vista_perfil"), true);
  assert.equal(esTipoEvento("vista_perfil "), false);
});

test("sin negocio, o con uno imposible, no hay evento", () => {
  assert.equal(parsearEvento({ tipo: "vista_menu" }), null);
  assert.equal(parsearEvento({ negocioId: "", tipo: "vista_menu" }), null);
  assert.equal(parsearEvento({ negocioId: "   ", tipo: "vista_menu" }), null);
  assert.equal(
    parsearEvento({ negocioId: "x".repeat(LARGO_MAX + 1), tipo: "vista_menu" }),
    null,
  );
});

test("un cuerpo que no es un evento se descarta sin reventar", () => {
  assert.equal(parsearEvento(null), null);
  assert.equal(parsearEvento(undefined), null);
  assert.equal(parsearEvento("vista_menu"), null);
  assert.equal(parsearEvento([1, 2]), null);
});

test("un nombre de producto larguísimo se recorta, no tira el evento", () => {
  const evento = parsearEvento({
    negocioId: "abc",
    tipo: "producto_visto",
    dimension: "y".repeat(500),
  });
  assert.equal(evento?.dimension.length, LARGO_MAX);
});
