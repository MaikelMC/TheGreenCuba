import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PROGRAMADOS_DEFAULT,
  costoEnvio,
  dividirParcheEntrega,
  esEntregaConfig,
  esParcheEntrega,
  fusionarEntrega,
  type EntregaConfig,
  type ParcheEntrega,
} from "@/lib/ficha/entrega";

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

test("guardar zonas no borra horario, pausa ni programados", () => {
  const actual: EntregaConfig = {
    costo: {
      modo: "zonas",
      zonas: [{ id: "centro", nombre: "Centro", monto: 100, moneda: "CUP", activa: true }],
      moneda: "CUP",
    },
    tiempo: { min: 20, max: 40 },
    horario: { semana: { lun: [{ abre: "09:00", cierra: "18:00" }] } },
    pausa: { desde: 1, hasta: 2, motivo: "sin gas" },
    programados: { ...PROGRAMADOS_DEFAULT, activo: true },
    recogida: true,
    pedidoMinimo: { monto: 10, moneda: "USD" },
    notaEntrega: "Entregamos hasta las 6.",
  };

  /* Lo que manda la tarjeta de zonas: su trozo, más el mínimo y la nota
     vacíos. No nombra horario, pausa ni programados. */
  const guardadoDeZonas: ParcheEntrega = {
    costo: {
      modo: "zonas",
      zonas: [{ id: "centro", nombre: "Centro", monto: 100, moneda: "CUP", activa: true }],
      moneda: "CUP",
    },
    tiempo: { min: 20, max: 40 },
    recogida: true,
    domicilio: true,
    pedidoMinimo: null,
    notaEntrega: null,
  };

  const fusionada = fusionarEntrega(actual, guardadoDeZonas);
  assert.ok(fusionada);
  assert.deepEqual(fusionada.horario, actual.horario);
  assert.deepEqual(fusionada.pausa, actual.pausa);
  assert.deepEqual(fusionada.programados, actual.programados);
  /* Lo que sí venía se aplicó, y lo que vino en `null` se quitó. */
  assert.equal(fusionada.domicilio, true);
  assert.equal("pedidoMinimo" in fusionada, false);
  assert.equal("notaEntrega" in fusionada, false);
});

test("un parche con null manda la clave a borrar, no la guarda como null", () => {
  const { poner, borrar } = dividirParcheEntrega({
    pedidoMinimo: null,
    notaEntrega: null,
    recogida: true,
  });

  assert.deepEqual([...borrar].sort(), ["notaEntrega", "pedidoMinimo"]);
  assert.equal("pedidoMinimo" in poner, false);
  assert.equal("notaEntrega" in poner, false);
  assert.equal(poner.recogida, true);
});

test("el parche rechaza claves que no existen en la entrega", () => {
  assert.equal(esParcheEntrega({ costo: { modo: "gratis" } }), true);
  assert.equal(esParcheEntrega({ fidelidad: {} }), false);
  assert.equal(esParcheEntrega({ costo: null }), false);
});

test("un guardado sin entrega no vacía la configuración", () => {
  const actual: EntregaConfig = {
    costo: { modo: "gratis" },
    tiempo: { min: 10, max: 20 },
    programados: { ...PROGRAMADOS_DEFAULT, activo: true },
  };
  assert.deepEqual(fusionarEntrega(actual, null), actual);
  assert.deepEqual(fusionarEntrega(actual, undefined), actual);
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
