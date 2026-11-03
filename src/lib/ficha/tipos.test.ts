import assert from "node:assert/strict";
import { test } from "node:test";
import {
  esTipoNegocio,
  normalizarModulos,
  posicionPortada,
  TIPOS_NEGOCIO,
} from "@/lib/ficha/tipos";

test("solo los cuatro tipos del alta son válidos", () => {
  for (const tipo of TIPOS_NEGOCIO) assert.equal(esTipoNegocio(tipo), true);
  assert.equal(esTipoNegocio("restaurante"), false);
  assert.equal(esTipoNegocio(null), false);
});

test("los módulos se desduplican y se descarta lo desconocido", () => {
  assert.deepEqual(
    normalizarModulos(["domicilio", "local", "domicilio", "inventado"]),
    ["domicilio", "local"],
  );
  assert.deepEqual(normalizarModulos("domicilio"), []);
  assert.deepEqual(normalizarModulos(undefined), []);
});

test("el encuadre se traduce a object-position", () => {
  assert.equal(posicionPortada("arriba"), "center top");
  assert.equal(posicionPortada("abajo"), "center bottom");
  assert.equal(posicionPortada(null), "center center");
});
