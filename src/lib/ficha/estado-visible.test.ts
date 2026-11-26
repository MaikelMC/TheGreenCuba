import assert from "node:assert/strict";
import { test } from "node:test";
import { estadoVisible, type Horario } from "@/lib/ficha/horario";
import { textoEstado } from "@/config/ficha";

/* Las fechas están en UTC y se leen en America/Havana (UTC-5 en enero). */
const JUEVES_10AM = new Date("2026-01-15T15:00:00Z"); // jue 15 ene, 10:00
const JUEVES_10PM = new Date("2026-01-16T03:00:00Z"); // jue 15 ene, 22:00
const VIERNES_10PM = new Date("2026-01-17T03:00:00Z"); // vie 16 ene, 22:00
const SABADO_MEDIANOCHE = new Date("2026-01-17T05:00:00Z"); // sáb 17 ene, 00:00

const semana = (franjas: Partial<Horario["semana"]>): Horario => ({
  semana: franjas,
});

function texto(estado: ReturnType<typeof estadoVisible>): string | null {
  return textoEstado(estado);
}

test("abierto: dice a qué hora cierra", () => {
  const estado = estadoVisible({
    horario: semana({ jue: [{ abre: "08:00", cierra: "23:00" }] }),
    now: JUEVES_10AM,
  });
  assert.equal(estado.abierto, true);
  assert.equal(texto(estado), "Abierto · cierra a las 23:00");
});

test("cerrado: abre hoy", () => {
  const estado = estadoVisible({
    horario: semana({ jue: [{ abre: "18:00", cierra: "23:00" }] }),
    now: JUEVES_10AM,
  });
  assert.equal(estado.abierto, false);
  assert.equal(texto(estado), "Cerrado · abre hoy a las 18:00");
  assert.ok(estado.proximaApertura !== null);
});

test("cerrado: abre mañana", () => {
  const estado = estadoVisible({
    horario: semana({
      jue: [{ abre: "08:00", cierra: "18:00" }],
      vie: [{ abre: "08:00", cierra: "18:00" }],
    }),
    now: JUEVES_10PM,
  });
  assert.equal(estado.diasHastaApertura, 1);
  assert.equal(texto(estado), "Cerrado · abre mañana a las 8:00");
});

test("cerrado: abre el lunes", () => {
  const estado = estadoVisible({
    horario: semana({ lun: [{ abre: "09:00", cierra: "17:00" }] }),
    now: VIERNES_10PM,
  });
  assert.equal(estado.diasHastaApertura, 3);
  assert.equal(texto(estado), "Cerrado · abre el lunes a las 9:00");
});

test("una franja que pasa de medianoche sigue abierta de madrugada", () => {
  const estado = estadoVisible({
    horario: semana({ vie: [{ abre: "22:00", cierra: "02:00" }] }),
    now: SABADO_MEDIANOCHE,
  });
  assert.equal(estado.abierto, true);
  assert.equal(texto(estado), "Abierto · cierra a las 2:00");
});

test("un cierre temporal se anuncia como tal", () => {
  const estado = estadoVisible({
    horario: semana({ jue: [{ abre: "08:00", cierra: "18:00" }] }),
    status: "temporary_closed",
    now: JUEVES_10AM,
  });
  assert.equal(estado.abierto, false);
  assert.equal(texto(estado), "Cerrado temporalmente");
});

test("el mensaje del dueño manda sobre el cierre temporal genérico", () => {
  const estado = estadoVisible({
    horario: semana({ jue: [{ abre: "08:00", cierra: "18:00" }] }),
    status: "temporary_closed",
    mensajeCierre: "Volvemos el lunes",
    now: JUEVES_10AM,
  });
  assert.equal(texto(estado), "Volvemos el lunes");
});

test("una semana sin ninguna franja no inventa ni abierto ni cerrado", () => {
  const estado = estadoVisible({
    horario: semana({ jue: [] }),
    now: JUEVES_10AM,
  });
  assert.equal(estado.sinHorario, true);
  assert.equal(estado.abreA, null);
  assert.equal(estado.proximaApertura, null);
  assert.equal(texto(estado), null);
});

test("sin horario no se afirma nada", () => {
  const estado = estadoVisible({ horario: null, now: JUEVES_10AM });
  assert.equal(estado.sinHorario, true);
  assert.equal(texto(estado), null);
});

test("una ficha antigua con horario en texto se lee igual", () => {
  const abierto = estadoVisible({
    horario: null,
    schedule: "9:00 a.m. - 6:00 p.m.",
    now: JUEVES_10AM,
  });
  assert.equal(abierto.abierto, true);
  assert.equal(texto(abierto), "Abierto · cierra a las 18:00");

  const cerrado = estadoVisible({
    horario: null,
    schedule: "9:00 a.m. - 6:00 p.m.",
    now: JUEVES_10PM,
  });
  assert.equal(cerrado.abierto, false);
  assert.equal(texto(cerrado), "Cerrado");
});

test("la apertura manual gana al horario", () => {
  const estado = estadoVisible({
    horario: {
      semana: { jue: [{ abre: "08:00", cierra: "18:00" }] },
      aperturaManual: { desde: JUEVES_10PM.getTime(), hasta: null },
    },
    now: JUEVES_10PM,
  });
  assert.equal(estado.abierto, true);
  assert.equal(texto(estado), "Abierto");
});
