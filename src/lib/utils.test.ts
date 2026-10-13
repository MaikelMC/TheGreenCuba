import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDate } from "@/lib/utils";

/**
 * La fecha suelta de los avisos —el fin de la prueba de Pro—. Lo que se
 * comprueba es que el mes y el día salen en el orden de aquí y que el año
 * aparece justo cuando la fecha ya no es la de ahora, que es la única rama que
 * tiene.
 */

test("sin año cuando la fecha es del año en curso", () => {
  assert.equal(formatDate(new Date(2026, 10, 12), new Date(2026, 0, 1)), "12 nov");
});

test("con año cuando la fecha es de otro año", () => {
  assert.equal(formatDate(new Date(2025, 0, 3), new Date(2026, 0, 1)), "3 ene 2025");
});

test("los doce meses salen en su sitio", () => {
  const ahora = new Date(2026, 0, 1);
  const meses = Array.from({ length: 12 }, (_, mes) =>
    formatDate(new Date(2026, mes, 1), ahora),
  );
  assert.deepEqual(meses, [
    "1 ene",
    "1 feb",
    "1 mar",
    "1 abr",
    "1 may",
    "1 jun",
    "1 jul",
    "1 ago",
    "1 sep",
    "1 oct",
    "1 nov",
    "1 dic",
  ]);
});
