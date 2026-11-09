import assert from "node:assert/strict";
import { test } from "node:test";
import { enmascararTelefono, normalizarTelefono, telefonoValido } from "./telefono";

test("acepta las formas en que se escribe un cubano y guarda +53XXXXXXXX", () => {
  for (const escrito of ["+53 5 123 4567", "53 51234567", "51234567"]) {
    assert.equal(normalizarTelefono(escrito), "+5351234567", escrito);
  }
  assert.equal(normalizarTelefono("+53-5-123-4567"), "+5351234567");
  assert.equal(normalizarTelefono("  +53 51234567  "), "+5351234567");
  /* Un fijo de La Habana también son ocho dígitos. */
  assert.equal(normalizarTelefono("7 123 4567"), "+5371234567");
});

test("rechaza lo que no tiene ocho dígitos nacionales", () => {
  assert.equal(normalizarTelefono(""), null);
  assert.equal(normalizarTelefono("   "), null);
  assert.equal(normalizarTelefono("5123456"), null);
  assert.equal(normalizarTelefono("512345678"), null);
  assert.equal(normalizarTelefono("+53 5123456"), null);
  assert.equal(normalizarTelefono("+1 305 123 4567"), null);
  assert.equal(normalizarTelefono("llámame"), null);
  assert.equal(normalizarTelefono("+53 (5) 123 4567"), null);
  assert.equal(telefonoValido("51234567"), true);
  assert.equal(telefonoValido("123"), false);
});

test("el teléfono se enseña enmascarado", () => {
  assert.equal(enmascararTelefono("+53 5 123 4567"), "+53 5••• ••67");
  assert.equal(enmascararTelefono("51234567"), "+53 5••• ••67");
  assert.equal(enmascararTelefono("5123456"), null);
});
