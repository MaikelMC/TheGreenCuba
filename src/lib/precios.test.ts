import assert from "node:assert/strict";
import { test } from "node:test";
import { convertirPrecio, monedasVista, type ConfigTasa } from "./precios";

const config: ConfigTasa = {
  tasaUsdCup: 400,
  tasaRedondeo: 5,
  tasaActualizadaEn: null,
  tasaEurCup: 450,
  tasaMlcCup: null,
  transferenciaPct: 10,
};

test("convertirPrecio pasa entre monedas vía CUP", () => {
  assert.equal(convertirPrecio("10", "USD", "CUP", config), "4000");
  assert.equal(convertirPrecio("9", "EUR", "USD", config), "10.13");
  assert.equal(convertirPrecio("1000", "CUP", "transfer", config), "1100");
  /* 1.01 × 400 = 404, redondeado hacia arriba al múltiplo de 5. */
  assert.equal(convertirPrecio("1.01", "USD", "CUP", config), "405");
});

test("convertirPrecio no inventa: rango, misma moneda o moneda sin tasa", () => {
  assert.equal(convertirPrecio("3–5", "USD", "CUP", config), null);
  assert.equal(convertirPrecio("10", "USD", "USD", config), null);
  assert.equal(convertirPrecio("10", "MLC", "CUP", config), null);
  assert.equal(convertirPrecio("10", "USD", "MLC", config), null);
});

test("monedasVista solo ofrece lo aceptado y configurado", () => {
  assert.deepEqual(monedasVista(["MLC", "CUP", "EUR", "transfer", "card"], config), [
    "CUP",
    "EUR",
    "transfer",
  ]);
  assert.deepEqual(monedasVista(["CUP"], null), []);
});
