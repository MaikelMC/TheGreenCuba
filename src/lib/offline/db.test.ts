import { test } from "node:test";
import assert from "node:assert/strict";

import { esErrorCuota, esErrorReintentable } from "./db";

test("InvalidStateError pide cerrar y reintentar", () => {
  assert.equal(esErrorReintentable({ name: "InvalidStateError" }), true);
});

test("un error normal no se reintenta a ciegas", () => {
  assert.equal(esErrorReintentable(new Error("otra cosa")), false);
});

test("una conexión que se está cerrando se reintenta", () => {
  assert.equal(
    esErrorReintentable(
      new Error(
        "Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.",
      ),
    ),
    true,
  );
});

test("QuotaExceededError se reconoce como cuota", () => {
  assert.equal(esErrorCuota({ name: "QuotaExceededError" }), true);
  assert.equal(esErrorCuota(new Error("quota exceeded")), true);
  assert.equal(esErrorCuota(new Error("otra cosa")), false);
});
