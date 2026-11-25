import { test } from "node:test";
import assert from "node:assert/strict";

import { digitosDeTelefono, normalizarBusqueda } from "./busqueda-texto";

test("normalizarBusqueda quita tildes, mayúsculas y espacios de más", () => {
  assert.equal(normalizarBusqueda("  CAFÉ   del   Mar  "), "cafe del mar");
  assert.equal(normalizarBusqueda("Piñón"), "pinon");
});

test("normalizarBusqueda no inventa texto cuando la entrada está vacía", () => {
  assert.equal(normalizarBusqueda("   "), "");
});

test("digitosDeTelefono deja solo números, con o sin +53", () => {
  assert.equal(digitosDeTelefono("+53 555-1234"), "535551234");
  assert.equal(digitosDeTelefono("555 1234"), "5551234");
  assert.equal(digitosDeTelefono("sin teléfono"), "");
});
