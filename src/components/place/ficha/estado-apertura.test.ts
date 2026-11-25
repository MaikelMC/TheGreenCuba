import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { EstadoApertura } from "./estado-apertura";

test("con nowIso fijo el HTML no depende de la zona horaria del proceso", () => {
  const anterior = process.env.TZ;
  const props = {
    horario: null,
    status: "active" as const,
    schedule: "Lun-Sáb 9 a 6",
    nowIso: "2026-11-02T14:00:00.000Z",
  };

  process.env.TZ = "UTC";
  const utc = renderToStaticMarkup(createElement(EstadoApertura, props));
  process.env.TZ = "Asia/Tokyo";
  const tokio = renderToStaticMarkup(createElement(EstadoApertura, props));

  process.env.TZ = anterior;
  assert.equal(utc, tokio);
  assert.match(utc, /Abierto|Cerrado|Lun-Sáb/);
});
