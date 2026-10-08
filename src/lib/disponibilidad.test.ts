import assert from "node:assert/strict";
import { test } from "node:test";
import { estaAgotado, hastaManana } from "./disponibilidad";

const AHORA = new Date("2026-10-08T12:00:00").getTime();

test("sin marcar, un producto nunca está agotado", () => {
  assert.equal(estaAgotado({}, AHORA), false);
  assert.equal(estaAgotado({ disponibilidad: "disponible" }, AHORA), false);
});

test("agotado sin fecha de vuelta sigue agotado", () => {
  assert.equal(estaAgotado({ disponibilidad: "agotado" }, AHORA), true);
  assert.equal(
    estaAgotado({ disponibilidad: "agotado", agotadoHasta: null }, AHORA),
    true,
  );
});

test("agotado con fecha futura sigue agotado", () => {
  assert.equal(
    estaAgotado({ disponibilidad: "agotado", agotadoHasta: AHORA + 1000 }, AHORA),
    true,
  );
});

test("agotado con la fecha ya pasada se considera disponible, sin cron", () => {
  assert.equal(
    estaAgotado({ disponibilidad: "agotado", agotadoHasta: AHORA - 1 }, AHORA),
    false,
  );
  /* El borde: justo en el instante de vuelta ya cuenta como disponible. */
  assert.equal(
    estaAgotado({ disponibilidad: "agotado", agotadoHasta: AHORA }, AHORA),
    false,
  );
});

test("«hasta mañana» cae en la medianoche local siguiente", () => {
  const tarde = new Date("2026-10-08T15:30:00");
  const vuelta = new Date(hastaManana(tarde));
  assert.equal(vuelta.getDate(), 9);
  assert.equal(vuelta.getHours(), 0);
  assert.equal(vuelta.getMinutes(), 0);
  assert.equal(vuelta.getSeconds(), 0);
  assert.ok(vuelta.getTime() > tarde.getTime());
});
