import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_METADATA_KEYS,
  MAX_QUERY,
  MAX_SHORT,
  clean,
  cleanCount,
  cleanMetadata,
} from "./sanitize";

/**
 * La limpieza es la última barrera antes de la base (`§43`): si esto se rompe,
 * una consulta de 3 000 caracteres o un `resultCount` negativo entran en
 * `analytics_events` y ensucian todas las métricas que leen de ahí.
 */

test("clean recorta y descarta el vacío", () => {
  assert.equal(clean("  hola  ", MAX_SHORT), "hola");
  assert.equal(clean("   ", MAX_SHORT), null);
  assert.equal(clean("", MAX_SHORT), null);
  assert.equal(clean(42, MAX_SHORT), null);
  assert.equal(clean(null, MAX_SHORT), null);
  assert.equal(clean(undefined, MAX_SHORT), null);
});

test("clean corta al máximo, no más", () => {
  const long = "x".repeat(MAX_QUERY + 50);
  const out = clean(long, MAX_QUERY);
  assert.equal(out?.length, MAX_QUERY);
});

test("cleanMetadata rechaza lo que no es un objeto plano", () => {
  assert.equal(cleanMetadata(null), null);
  assert.equal(cleanMetadata("texto"), null);
  assert.equal(cleanMetadata(["a"]), null);
  assert.equal(cleanMetadata({}), null);
  assert.equal(cleanMetadata({ a: null, b: 7 }), null);
});

test("cleanMetadata conserva texto, recorta claves y valores", () => {
  const key = "k".repeat(60);
  const value = "v".repeat(MAX_SHORT + 20);
  const out = cleanMetadata({ [key]: value, ok: "sí" });
  assert.deepEqual(out, {
    [key.slice(0, 40)]: value.slice(0, MAX_SHORT),
    ok: "sí",
  });
});

test("cleanMetadata se queda con 8 claves como mucho", () => {
  const input: Record<string, string> = {};
  for (let i = 0; i < 30; i += 1) input[`k${i}`] = `v${i}`;
  const out = cleanMetadata(input);
  assert.equal(Object.keys(out ?? {}).length, MAX_METADATA_KEYS);
});

test("cleanCount redondea y acota a un entero no negativo", () => {
  assert.equal(cleanCount(3.6), 4);
  assert.equal(cleanCount(-5), 0);
  assert.equal(cleanCount(999_999), 100_000);
  assert.equal(cleanCount(0), 0);
});

test("cleanCount descarta lo que no es un número finito", () => {
  assert.equal(cleanCount("12"), null);
  assert.equal(cleanCount(Number.NaN), null);
  assert.equal(cleanCount(Number.POSITIVE_INFINITY), null);
  assert.equal(cleanCount(null), null);
});
