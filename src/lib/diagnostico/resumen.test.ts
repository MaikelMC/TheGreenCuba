import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluarResumen } from "./resumen";

const BASE = {
  sesiones: 100,
  cargasMapa: 90,
  android: 40,
  androidSinWebgl: 1,
  erroresAltos: 0,
  cargasLentasOError: 2,
  swRegistrado: 80,
  swDesactualizado: 2,
  sinClasificar: 0,
};

test("sin problemas devuelve una lista vacía", () => {
  assert.deepEqual(evaluarResumen(BASE), []);
});

test("el mapa sin cargas con muchas sesiones es grave", () => {
  const avisos = evaluarResumen({ ...BASE, cargasMapa: 0 });
  assert.equal(avisos[0]?.nivel, "grave");
});

test("más de 5 % de Android sin WebGL es grave", () => {
  const avisos = evaluarResumen({ ...BASE, androidSinWebgl: 3 });
  assert.equal(avisos.some((a) => a.texto.includes("WebGL")), true);
});

test("no registrar el SW es un aviso", () => {
  const avisos = evaluarResumen({
    ...BASE,
    swRegistrado: 0,
    swDesactualizado: 0,
  });
  assert.equal(avisos.some((a) => a.nivel === "aviso"), true);
});

test("las sesiones sin clasificar son un aviso", () => {
  const avisos = evaluarResumen({ ...BASE, sinClasificar: 3 });
  assert.equal(avisos.some((a) => a.texto.includes("sin clasificar")), true);
});
