import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aperturaManualPara,
  estadoApertura,
  proximaAperturaMs,
  sinAperturaManual,
  type Horario,
} from "./horario";
import { estadoCocina } from "./cocina";
import type { EntregaConfig } from "./entrega";

/* 08:00–18:00 todos los días, como PQTT? Pizzería. */
const franja = [{ abre: "08:00", cierra: "18:00" }];
const HORARIO: Horario = {
  semana: { lun: franja, mar: franja, mie: franja, jue: franja, vie: franja, sab: franja, dom: franja },
};
/* 23:36 en La Habana (UTC-5): fuera de horario. */
const NOCHE = new Date("2026-11-19T04:36:00Z");
/* 08:00 del día siguiente en La Habana. */
const MANANA_8 = Date.parse("2026-11-19T13:00:00Z");

test("fuera de horario, la próxima apertura es mañana a las 08:00", () => {
  assert.equal(proximaAperturaMs(HORARIO, NOCHE), MANANA_8);
});

test("abrir a mano fuera de horario abre hasta la próxima apertura", () => {
  const manual = aperturaManualPara(HORARIO, NOCHE);
  assert.deepEqual(manual, { desde: NOCHE.getTime(), hasta: MANANA_8 });

  const conManual = { ...HORARIO, aperturaManual: manual };
  assert.equal(estadoApertura({ horario: conManual, now: NOCHE }).abierto, true);
  assert.equal(estadoApertura({ horario: HORARIO, now: NOCHE }).abierto, false, "sin ella, cerrado");
});

test("dentro de horario no hace falta apertura manual", () => {
  const mediodia = new Date("2026-11-19T17:00:00Z"); // 12:00 en La Habana
  assert.equal(aperturaManualPara(HORARIO, mediodia), undefined);
});

test("pasada la próxima apertura vuelve a mandar el horario", () => {
  const conManual: Horario = { ...HORARIO, aperturaManual: { desde: NOCHE.getTime(), hasta: MANANA_8 } };
  const mananaNoche = new Date("2026-11-19T23:30:00Z"); // 18:30 en La Habana
  assert.equal(estadoApertura({ horario: conManual, now: mananaNoche }).abierto, false);
});

test("cerrar a mano gana a la apertura manual", () => {
  const conManual: Horario = { ...HORARIO, aperturaManual: { desde: NOCHE.getTime(), hasta: null } };
  assert.equal(
    estadoApertura({ horario: conManual, status: "temporary_closed", now: NOCHE }).abierto,
    false,
  );
  assert.equal(sinAperturaManual(conManual).aperturaManual, undefined);
});

test("cocina: la apertura manual gana al horario y la pausa gana a las dos", () => {
  const entrega: EntregaConfig = {
    costo: { modo: "consultar" },
    tiempo: { min: 0, max: 0 },
    horario: HORARIO,
  };
  assert.equal(estadoCocina(entrega, null, NOCHE.getTime()).abierta, false, "por horario");

  const abierta = { ...entrega, aperturaManual: { desde: NOCHE.getTime(), hasta: MANANA_8 } };
  assert.equal(estadoCocina(abierta, null, NOCHE.getTime()).abierta, true);

  const pausada = { ...abierta, pausa: { desde: NOCHE.getTime(), hasta: null } };
  assert.equal(estadoCocina(pausada, null, NOCHE.getTime()).abierta, false);
});
