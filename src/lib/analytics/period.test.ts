import { test } from "node:test";
import assert from "node:assert/strict";

import { isoDay, normalizePeriod, presetRange } from "./period";

/**
 * El periodo decide qué entra en cada consulta (`§32`). Dos fallos aquí se ven
 * en pantalla pero no en un log: un rango que se recorta a cero filas, o una
 * pestaña «Hoy» que en realidad cubre dos días.
 */

/** Días de calendario entre dos «YYYY-MM-DD», en UTC. */
function daysBetween(from: string, to: string): number {
  return (
    (new Date(`${to}T00:00:00.000Z`).getTime() -
      new Date(`${from}T00:00:00.000Z`).getTime()) /
    86_400_000
  );
}

test("isoDay habla en UTC, no en la zona local", () => {
  assert.equal(isoDay(new Date("2026-10-04T00:00:00.000Z")), "2026-10-04");
  assert.equal(isoDay(new Date("2026-10-04T23:59:59.000Z")), "2026-10-04");
  assert.equal(isoDay(new Date("2026-10-05T00:00:00.000Z")), "2026-10-05");
});

test("normalizePeriod respeta un rango válido", () => {
  assert.deepEqual(normalizePeriod("2026-09-01", "2026-09-30"), {
    from: "2026-09-01",
    to: "2026-09-30",
  });
});

test("normalizePeriod sin fechas usa los últimos 30 días", () => {
  const { from, to } = normalizePeriod(null, null);
  assert.equal(to, isoDay(new Date()));
  assert.equal(daysBetween(from, to), 29);
});

test("normalizePeriod ignora fechas mal formadas", () => {
  const expected = normalizePeriod(null, "2026-09-30");
  assert.deepEqual(normalizePeriod("ayer", "2026-09-30"), expected);
  assert.deepEqual(normalizePeriod("2026/09/01", "2026-09-30"), expected);
  assert.equal(daysBetween(expected.from, expected.to), 29);
});

test("normalizePeriod recorta un rango mayor de 366 días", () => {
  const { from, to } = normalizePeriod("2020-01-01", "2026-09-30");
  assert.equal(to, "2026-09-30");
  assert.equal(daysBetween(from, to), 365);
});

test("normalizePeriod ordena un rango invertido", () => {
  assert.deepEqual(normalizePeriod("2026-09-30", "2026-09-01"), {
    from: "2026-09-01",
    to: "2026-09-30",
  });
});

test("presetRange: hoy cubre un solo día", () => {
  const { from, to } = presetRange("today");
  assert.equal(from, to);
});

test("presetRange: cada preset incluye el día de hoy en su cuenta", () => {
  assert.equal(daysBetween(presetRange("7d").from, presetRange("7d").to), 6);
  assert.equal(daysBetween(presetRange("30d").from, presetRange("30d").to), 29);
  assert.equal(daysBetween(presetRange("90d").from, presetRange("90d").to), 89);
});

test("presetRange: 'year' arranca el 1 de enero UTC", () => {
  const { from, to } = presetRange("year");
  assert.equal(from, `${to.slice(0, 4)}-01-01`);
});
