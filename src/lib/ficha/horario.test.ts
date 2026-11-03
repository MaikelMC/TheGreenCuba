import assert from "node:assert/strict";
import { test } from "node:test";
import {
  estadoAhora,
  estadoApertura,
  estadoDesdeTexto,
  esHorario,
  type Horario,
} from "@/lib/ficha/horario";

/**
 * Las horas son de La Habana (UTC−5 en enero). Las fechas de prueba se eligen
 * en invierno a propósito: en verano el desplazamiento cambia y un test escrito
 * sobre UTC−4 se caería medio año.
 */

const JUEVES_10AM = new Date("2026-01-15T15:00:00Z"); // jue 15 ene, 10:00
const JUEVES_1830 = new Date("2026-01-15T23:30:00Z"); // jue 15 ene, 18:30
const JUEVES_2200 = new Date("2026-01-16T03:00:00Z"); // jue 15 ene, 22:00
const SABADO_MEDIANOCHE = new Date("2026-01-17T05:00:00Z"); // sáb 17 ene, 00:00

const semana = (franjas: Partial<Horario["semana"]>): Horario => ({
  semana: franjas,
});

test("dentro de una franja está abierto y dice a qué hora cierra", () => {
  const estado = estadoApertura({
    horario: semana({ jue: [{ abre: "08:00", cierra: "18:00" }] }),
    now: JUEVES_10AM,
  });
  assert.equal(estado.abierto, true);
  assert.equal(estado.cierraA, "18:00");
  assert.equal(estado.sinHorario, false);
});

test("fuera de la franja está cerrado y dice cuándo abre", () => {
  const estado = estadoApertura({
    horario: semana({
      jue: [{ abre: "08:00", cierra: "18:00" }],
      vie: [{ abre: "08:00", cierra: "18:00" }],
    }),
    now: JUEVES_1830,
  });
  assert.equal(estado.abierto, false);
  assert.equal(estado.abreA, "08:00");
  assert.equal(estado.diasHastaApertura, 1);
});

test("una franja que cruza medianoche sigue abierta de madrugada", () => {
  /* El sábado a las 00:00 lo que manda es la franja del viernes 22:00–02:00. */
  const estado = estadoApertura({
    horario: semana({ vie: [{ abre: "22:00", cierra: "02:00" }] }),
    now: SABADO_MEDIANOCHE,
  });
  assert.equal(estado.abierto, true);
  assert.equal(estado.cierraA, "02:00");
});

test("una excepción cerrada gana a la semana", () => {
  const estado = estadoApertura({
    horario: {
      semana: { jue: [{ abre: "08:00", cierra: "18:00" }] },
      excepciones: [
        { fecha: "2026-01-15", cerrado: true, mensaje: "Cerrado por inventario" },
      ],
    },
    now: JUEVES_10AM,
  });
  assert.equal(estado.abierto, false);
  assert.equal(estado.mensaje, "Cerrado por inventario");
});

test("el cierre temporal manda sobre el horario y usa su mensaje", () => {
  const estado = estadoApertura({
    horario: semana({ jue: [{ abre: "08:00", cierra: "18:00" }] }),
    status: "temporary_closed",
    mensajeCierre: "Volvemos el lunes",
    now: JUEVES_10AM,
  });
  assert.equal(estado.abierto, false);
  assert.equal(estado.sinHorario, false);
  assert.equal(estado.mensaje, "Volvemos el lunes");
});

test("sin horario no se afirma nada", () => {
  const estado = estadoApertura({ horario: null, now: JUEVES_10AM });
  assert.equal(estado.sinHorario, true);
  assert.equal(estado.abierto, false);
  assert.equal(estado.abreA, null);
});

/* ── El horario que el dueño escribió a mano ─────────────────────────── */

test("un rango con am/pm se respeta a la hora que sea", () => {
  assert.deepEqual(estadoDesdeTexto("9:00 a.m. - 6:00 p.m.", JUEVES_10AM), {
    estado: "abierto",
    cierraA: "18:00",
  });
  assert.deepEqual(estadoDesdeTexto("9:00 a.m. - 6:00 p.m.", JUEVES_2200), {
    estado: "cerrado",
    cierraA: null,
  });
});

test("un rango en 24 horas se entiende sin am/pm", () => {
  assert.equal(estadoDesdeTexto("09:00-18:00", JUEVES_10AM).estado, "abierto");
  assert.equal(estadoDesdeTexto("09:00-18:00", JUEVES_2200).estado, "cerrado");
});

test("«9 a 6» es ambiguo y no se afirma nada", () => {
  /* Podría ser de la mañana o de la noche: una de las dos lecturas miente. */
  assert.equal(estadoDesdeTexto("9 a 6", JUEVES_10AM).estado, "desconocido");
});

test("un texto con días no se interpreta a ciegas", () => {
  assert.equal(
    estadoDesdeTexto("Lun-Sáb 9:00 a.m. - 6:00 p.m.", JUEVES_10AM).estado,
    "desconocido",
  );
});

test("«de día» y «de noche» siguen valiendo como franja", () => {
  assert.equal(estadoDesdeTexto("De noche", JUEVES_2200).estado, "abierto");
  assert.equal(estadoDesdeTexto("De noche", JUEVES_10AM).estado, "cerrado");
  assert.equal(estadoDesdeTexto("De día", JUEVES_10AM).estado, "abierto");
  assert.equal(estadoDesdeTexto("Todo el día", JUEVES_2200).estado, "abierto");
});

test("un rango en texto que cruza medianoche sigue abierto de madrugada", () => {
  assert.deepEqual(
    estadoDesdeTexto("10:00 p.m. - 2:00 a.m.", SABADO_MEDIANOCHE),
    { estado: "abierto", cierraA: "02:00" },
  );
});

test("sin texto, o con algo que no es una hora, no se afirma nada", () => {
  for (const texto of ["", "   ", null, "Preguntar al dueño", "Cerrado"]) {
    assert.equal(estadoDesdeTexto(texto, JUEVES_10AM).estado === "abierto", false);
  }
  assert.equal(estadoDesdeTexto("", JUEVES_10AM).estado, "desconocido");
  assert.equal(estadoDesdeTexto("Cerrado", JUEVES_10AM).estado, "cerrado");
});

test("el estado enseñable prefiere el horario estructurado al texto", () => {
  const comun = {
    horario: semana({ jue: [{ abre: "08:00", cierra: "18:00" }] }),
    schedule: "Todo el día",
  };

  assert.equal(estadoAhora({ ...comun, now: JUEVES_10AM }), "abierto");
  /* El texto dice «Todo el día», pero el horario por día manda. */
  assert.equal(estadoAhora({ ...comun, now: JUEVES_2200 }), "cerrado");
});

test("el estado enseñable cae al texto cuando no hay horario", () => {
  const sinHorario = { horario: null, now: JUEVES_2200 };
  assert.equal(
    estadoAhora({ ...sinHorario, schedule: "9:00 a.m. - 6:00 p.m." }),
    "cerrado",
  );
  assert.equal(
    estadoAhora({ ...sinHorario, schedule: "Lun-Sáb 9 a 6" }),
    "desconocido",
  );
  assert.equal(
    estadoAhora({ ...sinHorario, schedule: "Todo el día", status: "closed" }),
    "cerrado",
  );
});

test("un horario mal formado se rechaza antes de guardarlo", () => {
  assert.equal(esHorario({ semana: {} }), true);
  assert.equal(
    esHorario({ semana: { jue: [{ abre: "08:00", cierra: "18:00" }] } }),
    true,
  );
  assert.equal(
    esHorario({ semana: { jue: [{ abre: "25:00", cierra: "18:00" }] } }),
    false,
  );
  /* Una excepción que no está cerrada necesita franjas: sin ellas se leería
     como un día cerrado sin decirlo. */
  assert.equal(
    esHorario({ semana: {}, excepciones: [{ fecha: "2026-01-15" }] }),
    false,
  );
});
