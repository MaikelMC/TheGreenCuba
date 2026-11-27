import assert from "node:assert/strict";
import { test } from "node:test";
import {
  datosPago,
  esSantiago,
  metodosDisponibles,
} from "./pagos-config";

// Env real - no incluir NODE_ENV etc, solo lo necesario
const ENV = {
  PAGOS_QVAPAY_USUARIO: "laverde",
  PAGOS_CUP_TARJETA: "9224 0000 0000 0000",
  PAGOS_CUP_TITULAR: "La Verde",
  PAGOS_EFECTIVO: "TRUE",
} as const;

// Tipo mínimo para pasar a datosPago (acepta ProcessEnv pero solo lee 4 keys)
const ENV_MIN = ENV as unknown as NodeJS.ProcessEnv;

test("los datos de pago salen del entorno y se recortan", () => {
  const datos = datosPago(ENV_MIN);
  assert.deepEqual(datos.qvapay, { usuario: "laverde" });
  assert.deepEqual(datos.transferencia, {
    tarjeta: "9224 0000 0000 0000",
    titular: "La Verde",
  });
  assert.equal(datos.efectivo, true);
});

test("QvaPay y transferencia se ofrecen aunque falten datos de cobro", () => {
  const datos = datosPago({
    PAGOS_QVAPAY_USUARIO: " ",
    PAGOS_CUP_TARJETA: "9224",
  } as unknown as NodeJS.ProcessEnv);
  assert.equal(datos.qvapay, null);
  assert.equal(datos.transferencia, null);
  assert.equal(datos.efectivo, false);
  assert.deepEqual(metodosDisponibles("La Habana", datos), [
    "qvapay",
    "transferencia",
  ]);
});

test("el efectivo solo se ofrece en Santiago de Cuba", () => {
  const datos = datosPago(ENV_MIN);
  assert.equal(esSantiago("Santiago de Cuba"), true);
  assert.equal(esSantiago("santiago"), true);
  assert.equal(esSantiago("La Habana"), false);
  assert.equal(esSantiago(null), false);

  assert.deepEqual(metodosDisponibles("Santiago de Cuba", datos), [
    "qvapay",
    "transferencia",
    "efectivo",
  ]);
  assert.deepEqual(metodosDisponibles("La Habana", datos), [
    "qvapay",
    "transferencia",
  ]);
});