import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FIDELIDAD_DEFAULT,
  aplicarCanje,
  cumpleCompraMinima,
  esFidelidadConfig,
  estadoTarjeta,
  restarSello,
  textoFalta,
  type FidelidadConfig,
} from "./fidelidad";

const CONFIG: FidelidadConfig = {
  activo: true,
  nombre: "Tarjeta del barrio",
  metas: [
    { sellos: 5, premio: "Un refresco gratis" },
    { sellos: 10, premio: "Un combo gratis" },
  ],
  compraMinima: null,
};

test("la configuración por defecto es válida", () => {
  assert.equal(esFidelidadConfig(FIDELIDAD_DEFAULT), true);
});

test("se rechazan metas vacías, desordenadas o fuera del tope", () => {
  assert.equal(esFidelidadConfig({ ...CONFIG, metas: [] }), false);
  assert.equal(
    esFidelidadConfig({
      ...CONFIG,
      metas: Array.from({ length: 5 }, (_, i) => ({ sellos: i + 1, premio: "Algo" })),
    }),
    false,
  );
  assert.equal(
    esFidelidadConfig({
      ...CONFIG,
      metas: [
        { sellos: 10, premio: "Combo" },
        { sellos: 5, premio: "Refresco" },
      ],
    }),
    false,
  );
  assert.equal(
    esFidelidadConfig({
      ...CONFIG,
      metas: [
        { sellos: 5, premio: "Refresco" },
        { sellos: 5, premio: "Combo" },
      ],
    }),
    false,
  );
  assert.equal(
    esFidelidadConfig({ ...CONFIG, metas: [{ sellos: 5, premio: " " }] }),
    false,
  );
  assert.equal(esFidelidadConfig({ ...CONFIG, nombre: "" }), false);
  assert.equal(
    esFidelidadConfig({ ...CONFIG, compraMinima: { monto: -1, moneda: "CUP" } }),
    false,
  );
});

test("la tarjeta dice qué falta, qué está listo y cuál es la siguiente meta", () => {
  const enCamino = estadoTarjeta(CONFIG, 3, 1);
  assert.equal(enCamino.siguiente?.sellos, 5);
  assert.equal(enCamino.siguiente?.faltan, 2);
  assert.equal(enCamino.listas.length, 0);
  assert.equal(textoFalta(enCamino), "Próximo premio: Un refresco gratis · te faltan 2 sellos");

  const conRefresco = estadoTarjeta(CONFIG, 6, 1);
  assert.deepEqual(
    conRefresco.listas.map((m) => m.premio),
    ["Un refresco gratis"],
  );
  assert.equal(conRefresco.siguiente?.sellos, 10);
  assert.equal(conRefresco.siguiente?.faltan, 4);

  /* Un canje del hito intermedio deja de estar listo sin mover los sellos. */
  const canjeado = estadoTarjeta(CONFIG, 6, 1, [0]);
  assert.equal(canjeado.listas.length, 0);
  assert.equal(canjeado.metas[0]?.canjeada, true);
  assert.equal(canjeado.siguiente?.sellos, 10);
});

test("canjear una meta intermedia no resta sellos y no se repite en el ciclo", () => {
  assert.deepEqual(aplicarCanje(CONFIG, 6, 1, 0), {
    sellos: 6,
    ciclo: 1,
    cantidad: 0,
    reinicio: false,
  });
  assert.equal(aplicarCanje(CONFIG, 6, 1, 0, [0]), null);
  assert.equal(aplicarCanje(CONFIG, 4, 1, 0), null);
});

test("canjear la última meta reinicia la tarjeta y conserva los sobrantes", () => {
  assert.deepEqual(aplicarCanje(CONFIG, 12, 1, 1), {
    sellos: 2,
    ciclo: 2,
    cantidad: -10,
    reinicio: true,
  });
  assert.deepEqual(aplicarCanje(CONFIG, 10, 3, 1), {
    sellos: 0,
    ciclo: 4,
    cantidad: -10,
    reinicio: true,
  });
  assert.equal(aplicarCanje(CONFIG, 9, 1, 1), null);
});

test("la compra mínima se compara en la moneda del pedido", () => {
  const minimo = { monto: 10, moneda: "USD" };
  assert.equal(cumpleCompraMinima({ total: 12, currency: "USD" }, minimo, null), true);
  assert.equal(cumpleCompraMinima({ total: 9, currency: "USD" }, minimo, null), false);
  assert.equal(cumpleCompraMinima({ total: 12, currency: "usd" }, minimo, null), true);
  assert.equal(cumpleCompraMinima(null, minimo, null), null);
  assert.equal(cumpleCompraMinima({ total: 12, currency: "USD" }, null, null), true);
});

test("sin tasa no se puede comprobar una moneda distinta; con tasa se convierte", () => {
  const minimo = { monto: 1000, moneda: "CUP" };
  assert.equal(cumpleCompraMinima({ total: 5, currency: "USD" }, minimo, null), null);
  assert.equal(cumpleCompraMinima({ total: 5, currency: "USD" }, minimo, 0), null);
  assert.equal(cumpleCompraMinima({ total: 5, currency: "USD" }, minimo, 200), true);
  assert.equal(cumpleCompraMinima({ total: 4, currency: "USD" }, minimo, 200), false);

  const minimoUsd = { monto: 10, moneda: "USD" };
  assert.equal(cumpleCompraMinima({ total: 2000, currency: "CUP" }, minimoUsd, 200), true);
  assert.equal(cumpleCompraMinima({ total: 1000, currency: "CUP" }, minimoUsd, 200), false);
  /* Una moneda que no es dólar ni CUP no se inventa. */
  assert.equal(cumpleCompraMinima({ total: 10, currency: "EUR" }, minimoUsd, 200), null);
});

test("la reversión no deja la tarjeta en negativo", () => {
  assert.equal(restarSello(4), 3);
  assert.equal(restarSello(1), 0);
  assert.equal(restarSello(0), 0);
});
