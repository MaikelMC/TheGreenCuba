import assert from "node:assert/strict";
import { test } from "node:test";
import { costoEnvio, esEntregaConfig } from "@/lib/ficha/entrega";

test("una configuración válida pasa", () => {
  assert.equal(
    esEntregaConfig({
      costo: { modo: "fijo", monto: 200, moneda: "CUP" },
      tiempo: { min: 20, max: 45 },
    }),
    true,
  );
  assert.equal(
    esEntregaConfig({ costo: { modo: "gratis" }, tiempo: { min: 10, max: 10 } }),
    true,
  );
});

test("se rechaza en vez de corregir montos y rangos imposibles", () => {
  /* Envío negativo. */
  assert.equal(
    esEntregaConfig({
      costo: { modo: "fijo", monto: -5, moneda: "CUP" },
      tiempo: { min: 20, max: 45 },
    }),
    false,
  );
  /* Rango invertido. */
  assert.equal(
    esEntregaConfig({ costo: { modo: "gratis" }, tiempo: { min: 60, max: 30 } }),
    false,
  );
  /* Zona sin nombre. */
  assert.equal(
    esEntregaConfig({
      costo: { modo: "zonas", zonas: [{ nombre: " ", monto: 100 }], moneda: "CUP" },
      tiempo: { min: 10, max: 30 },
    }),
    false,
  );
});

test("el costo del envío se deriva del modo", () => {
  assert.equal(costoEnvio({ modo: "gratis" }, 0), 0);
  assert.equal(costoEnvio({ modo: "consultar" }, 0), null);
  assert.equal(costoEnvio({ modo: "fijo", monto: 200, moneda: "CUP" }, 0), 200);
  /* Gratis a partir del mínimo; por debajo se cobra la tarifa. */
  assert.equal(
    costoEnvio({ modo: "gratis_desde", desde: 1500, monto: 200, moneda: "CUP" }, 1500),
    0,
  );
  assert.equal(
    costoEnvio({ modo: "gratis_desde", desde: 1500, monto: 200, moneda: "CUP" }, 800),
    200,
  );
  /* Las zonas las elige el carrito: aquí no se adivina. */
  assert.equal(
    costoEnvio({ modo: "zonas", zonas: [{ id: "1", nombre: "Centro", monto: 100, moneda: "CUP", activa: true }], moneda: "CUP" }, 0),
    null,
  );
});
