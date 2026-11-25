import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ETAPAS_PROSPECTO,
  etapaAnterior,
  siguienteEtapa,
  textoOrigen,
} from "./prospectos";

test("las cinco etapas están en orden comercial", () => {
  assert.deepEqual(ETAPAS_PROSPECTO, [
    "contactado",
    "visitado",
    "interesado",
    "pack_enviado",
    "pagando",
  ]);
});

test("avanzar recorre la etapa siguiente y se detiene en Pagando", () => {
  assert.equal(siguienteEtapa("contactado"), "visitado");
  assert.equal(siguienteEtapa("pack_enviado"), "pagando");
  assert.equal(siguienteEtapa("pagando"), null);
});

test("retroceder se detiene en Contactado", () => {
  assert.equal(etapaAnterior("pagando"), "pack_enviado");
  assert.equal(etapaAnterior("contactado"), null);
});

test("el origen nombra el código del afiliado cuando existe", () => {
  assert.equal(textoOrigen("afiliado", "ABC123"), "Afiliado · ABC123");
  assert.equal(textoOrigen("analytics", "  "), "Analytics");
});
