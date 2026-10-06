import { test } from "node:test";
import assert from "node:assert/strict";

import { BOM, cell, csv } from "./csv";

/**
 * Un CSV mal escapado no da error: da un archivo que abre torcido y que nadie
 * vuelve a usar. Las tres cosas que importan —comillas dobladas, BOM y CRLF—
 * son las que se prueban aquí (`§35`).
 */

test("cell entrecomilla siempre y dobla las comillas internas", () => {
  assert.equal(cell('dice "hola"'), '"dice ""hola"""');
  assert.equal(cell("con, coma"), '"con, coma"');
  assert.equal(cell("linea\nnueva"), '"linea\nnueva"');
});

test("cell convierte números y vacía lo ausente", () => {
  assert.equal(cell(0), '"0"');
  assert.equal(cell(12.5), '"12.5"');
  assert.equal(cell(null), '""');
  assert.equal(cell(undefined), '""');
});

test("csv empieza con BOM para que Excel no rompa los acentos", () => {
  const out = csv(["a"], []);
  assert.ok(out.startsWith(BOM));
  assert.ok(out.includes('"a"'));
});

test("csv usa CRLF y cierra la última línea", () => {
  const out = csv(["a", "b"], [[1, 2]]);
  assert.equal(out, `${BOM}"a","b"\r\n"1","2"\r\n`);
});

test("csv con cabecera y sin filas no inventa datos", () => {
  const out = csv(["a", "b"], []);
  assert.equal(out, `${BOM}"a","b"\r\n`);
});
