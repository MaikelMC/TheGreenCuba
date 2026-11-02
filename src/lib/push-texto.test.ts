import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_CUERPO_PUSH, recortarTexto } from "@/lib/push-texto";

/**
 * El cuerpo de una notificación lo recorta el sistema operativo si no cabe, y
 * lo hace en mitad de una palabra. Esta función lo corta antes y en español,
 * que es lo que convierte «Cafeterí…» en «Cafetería del…».
 */

test("un texto que cabe se queda igual, sin saltos ni espacios de más", () => {
  assert.equal(recortarTexto("  Tostados   del día\n", MAX_CUERPO_PUSH), "Tostados del día");
});

test("un texto largo se corta en una palabra entera y acaba en puntos suspensivos", () => {
  const texto = "Cafetería con tostados del día y ofertas de la tarde para toda la familia";
  const recortado = recortarTexto(texto, 40);

  assert.ok(recortado.endsWith("…"));
  assert.ok(recortado.length <= 40);
  assert.ok(texto.startsWith(recortado.slice(0, -1).trimEnd()));
  /* No corta a mitad de palabra: lo que queda antes del «…» es una palabra del
     original. */
  const ultima = recortado.slice(0, -1).trimEnd().split(" ").pop();
  assert.ok(texto.split(" ").includes(ultima ?? ""));
});

test("una palabra sin espacios se corta igual y nunca pasa del máximo", () => {
  const recortado = recortarTexto("a".repeat(200), 30);
  assert.equal(recortado.length, 30);
  assert.ok(recortado.endsWith("…"));
});
