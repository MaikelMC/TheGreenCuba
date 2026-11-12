import assert from "node:assert/strict";
import { test } from "node:test";
import { calcularVencimiento } from "./pack-medida";
import { DIAS_PRIMER_PAGO, DIAS_RENOVACION } from "./plans";

const DIA = 86_400_000;
const HOY = new Date("2026-10-08T12:00:00Z");

test("el primer pago con 2×1 cubre dos meses", () => {
  const vence = calcularVencimiento({
    desde: HOY,
    oferta2x1: true,
    venceEnActual: null,
  });

  assert.equal(vence.getTime(), HOY.getTime() + DIAS_PRIMER_PAGO * DIA);
});

test("el primer pago sin 2×1 cubre un mes", () => {
  const vence = calcularVencimiento({
    desde: HOY,
    oferta2x1: false,
    venceEnActual: null,
  });

  assert.equal(vence.getTime(), HOY.getTime() + DIAS_RENOVACION * DIA);
});

test("renovar un pack vigente suma un mes al vencimiento actual", () => {
  const venceActual = new Date("2026-10-20T12:00:00Z");
  const vence = calcularVencimiento({
    desde: HOY,
    oferta2x1: true,
    venceEnActual: venceActual,
  });

  assert.equal(vence.getTime(), venceActual.getTime() + DIAS_RENOVACION * DIA);
});

test("renovar un pack vencido cuenta desde hoy y no repite el 2×1", () => {
  const venceActual = new Date("2026-10-01T12:00:00Z");
  const vence = calcularVencimiento({
    desde: HOY,
    oferta2x1: true,
    venceEnActual: venceActual,
  });

  assert.equal(vence.getTime(), HOY.getTime() + DIAS_RENOVACION * DIA);
});
