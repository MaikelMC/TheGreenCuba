import assert from "node:assert/strict";
import { test } from "node:test";
import {
  esPeriodo,
  pareceFraude,
  periodoAnterior,
  periodoDe,
  rangoPeriodo,
  topPorGrupo,
  type CandidatoRanking,
} from "./ranking";

test("el periodo sale de la fecha, en UTC", () => {
  assert.equal(periodoDe(new Date("2026-10-10T23:59:59Z")), "2026-10");
  /* Cerca de medianoche el mes no baila: UTC manda, no la hora del servidor. */
  assert.equal(periodoDe(new Date("2026-11-01T00:00:00Z")), "2026-11");
});

test("el job cierra el mes anterior, también al cruzar el año", () => {
  assert.equal(periodoAnterior(new Date("2026-10-10T12:00:00Z")), "2026-09");
  /* Enero tiene que retroceder a diciembre del año pasado, no a «2026-00». */
  assert.equal(periodoAnterior(new Date("2026-01-05T12:00:00Z")), "2025-12");
});

test("el rango del periodo llega al último día, febrero incluido", () => {
  assert.deepEqual(rangoPeriodo("2026-10"), {
    desde: "2026-10-01",
    hasta: "2026-10-31",
  });
  /* 2026 no es bisiesto; 2028 sí. El día 0 del mes siguiente resuelve los dos. */
  assert.equal(rangoPeriodo("2026-02").hasta, "2026-02-28");
  assert.equal(rangoPeriodo("2028-02").hasta, "2028-02-29");
});

test("un periodo con forma mala se rechaza", () => {
  assert.equal(esPeriodo("2026-10"), true);
  assert.equal(esPeriodo("2026-13"), false);
  assert.equal(esPeriodo("2026-00"), false);
  assert.equal(esPeriodo("2026-1"), false);
  assert.equal(esPeriodo(""), false);
  assert.equal(esPeriodo(null), false);
});

test("el umbral anti-fraude es estricto: justo el 40% pasa", () => {
  /* 2 de 5 = 40%: al límite, no se descarta. */
  assert.equal(pareceFraude([2, 1, 1, 1]), false);
  /* 3 de 7 ≈ 42,8%: por encima, se descarta. */
  assert.equal(pareceFraude([3, 1, 1, 1, 1]), true);
  /* Un solo visitante es el 100%: inflado por definición. */
  assert.equal(pareceFraude([9]), true);
  /* Un negocio con reparto sano no se toca. */
  assert.equal(pareceFraude([1, 1, 1, 1, 1, 1]), false);
  /* Sin datos no hay fraude que declarar. */
  assert.equal(pareceFraude([]), false);
});

function candidato(extra: Partial<CandidatoRanking>): CandidatoRanking {
  return { negocioId: "n1", categoria: "cafe", municipio: "Santiago", visitas: 1, ...extra };
}

test("el podio es de tres, por grupo, con las visitas de más a menos", () => {
  const puestos = topPorGrupo([
    candidato({ negocioId: "a", visitas: 10 }),
    candidato({ negocioId: "b", visitas: 30 }),
    candidato({ negocioId: "c", visitas: 20 }),
    candidato({ negocioId: "d", visitas: 5 }),
  ]);

  assert.deepEqual(
    puestos.map((p) => [p.negocioId, p.posicion]),
    [["b", 1], ["c", 2], ["a", 3]],
  );
});

test("cada categoría y municipio es su propio grupo", () => {
  const puestos = topPorGrupo([
    candidato({ negocioId: "a", visitas: 10 }),
    /* Misma categoría, otro municipio: no compite con el de arriba. */
    candidato({ negocioId: "b", municipio: "Holguín", visitas: 1 }),
    /* Otro municipio de la misma categoría, con más visitas que el primero, pero
       en su propio grupo. */
    candidato({ negocioId: "c", municipio: "Holguín", visitas: 99 }),
  ]);

  const holguin = puestos.filter((p) => p.municipio === "Holguín");
  assert.deepEqual(
    holguin.map((p) => p.negocioId),
    ["c", "b"],
  );
  assert.equal(puestos.find((p) => p.negocioId === "a")?.posicion, 1);
});

test("las visitas en cero o menos no entran al podio", () => {
  const puestos = topPorGrupo([
    candidato({ negocioId: "a", visitas: 0 }),
    candidato({ negocioId: "b", visitas: -3 }),
    candidato({ negocioId: "c", visitas: 2 }),
  ]);
  assert.deepEqual(puestos.map((p) => p.negocioId), ["c"]);
});

test("a igualdad de visitas decide el id, para que no baile entre corridas", () => {
  const orden = () =>
    topPorGrupo([
      candidato({ negocioId: "z", visitas: 7 }),
      candidato({ negocioId: "a", visitas: 7 }),
    ]).map((p) => p.negocioId);
  assert.deepEqual(orden(), ["a", "z"]);
  /* Y da igual el orden en que lleguen las filas. */
  assert.deepEqual(
    topPorGrupo([
      candidato({ negocioId: "a", visitas: 7 }),
      candidato({ negocioId: "z", visitas: 7 }),
    ]).map((p) => p.negocioId),
    ["a", "z"],
  );
});
