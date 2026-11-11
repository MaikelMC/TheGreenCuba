import assert from "node:assert/strict";
import { test } from "node:test";
import { leerTasaCambio } from "./tasa-cambio-parse";

test("lee la muestra más reciente de cupHistory", () => {
  const tasa = leerTasaCambio({
    cupHistory: [
      { updated_at: "2026-11-10T23:20:19.435Z", value: 1083.3211 },
      { updated_at: "2026-11-10T23:10:19.637Z", value: 1083.4549 },
    ],
  });

  assert.deepEqual(tasa, {
    usdCup: 1083.3211,
    actualizadaEn: "2026-11-10T23:20:19.435Z",
  });
});

test("elige por fecha, no por orden, y acepta la forma de /api/v1/history", () => {
  const tasa = leerTasaCambio({
    data: [
      { time: "2026-11-09T12:00:00Z", value: 1100 },
      { time: "2026-11-10T12:00:00Z", value: 1083 },
    ],
  });

  assert.equal(tasa?.usdCup, 1083);
  assert.equal(tasa?.actualizadaEn, "2026-11-10T12:00:00.000Z");
});

test("acepta el valor como cadena numérica", () => {
  const tasa = leerTasaCambio({
    cupHistory: [{ updated_at: "2026-11-10T23:20:19Z", value: "1083.32" }],
  });

  assert.equal(tasa?.usdCup, 1083.32);
});

test("descarta valores fuera de rango o que no son números", () => {
  const tasa = leerTasaCambio({
    cupHistory: [
      { updated_at: "2026-11-10T23:22:00Z", value: 0 },
      { updated_at: "2026-11-10T23:21:00Z", value: "mucho" },
      { updated_at: "2026-11-10T23:20:19Z", value: 1083.32 },
    ],
  });

  assert.equal(tasa?.usdCup, 1083.32);
});

test("sin muestra válida devuelve null y no lanza", () => {
  assert.equal(leerTasaCambio(null), null);
  assert.equal(leerTasaCambio({}), null);
  assert.equal(leerTasaCambio({ cupHistory: [] }), null);
  assert.equal(leerTasaCambio({ cupHistory: [{ value: -1 }] }), null);
  assert.equal(leerTasaCambio("1083"), null);
});

test("una fila sin fecha sigue valiendo y conserva la fecha vacía", () => {
  const tasa = leerTasaCambio({ cupHistory: [{ value: 1083 }] });

  assert.deepEqual(tasa, { usdCup: 1083, actualizadaEn: null });
});
