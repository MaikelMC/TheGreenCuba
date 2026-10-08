import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hrefPedido,
  mensajePedido,
  precioDeLinea,
  totalDePedido,
  type LineaPedido,
} from "./pedido";
import { normalizarWhatsappCubano } from "./contact-links";

const linea = (extra: Partial<LineaPedido> = {}): LineaPedido => ({
  id: "p1",
  name: "Arroz con pollo",
  price: "1200",
  currency: "CUP",
  qty: 1,
  ...extra,
});

test("una cifra pelada se lee; un rango toma su suelo; sin cifra no hay precio", () => {
  assert.equal(precioDeLinea("1200"), 1200);
  assert.equal(precioDeLinea("3.50"), 3.5);
  assert.equal(precioDeLinea("3,50 USD"), 3.5);
  assert.equal(precioDeLinea("3–5 USD"), 3);
  assert.equal(precioDeLinea("Desde 8"), 8);
  assert.equal(precioDeLinea("A convenir"), null);
  assert.equal(precioDeLinea(""), null);
});

test("el total suma cantidad por precio con una sola moneda", () => {
  const total = totalDePedido([
    linea({ qty: 2 }),
    linea({ id: "p2", name: "Refresco", price: "150", qty: 3 }),
  ]);
  assert.deepEqual(total, { total: 2850, currency: "CUP" });
});

test("sin cifra en alguna línea no hay total, pero las líneas siguen", () => {
  assert.equal(totalDePedido([linea({ price: "A convenir" })]), null);
  assert.equal(
    totalDePedido([linea(), linea({ id: "p2", price: "A convenir" })]),
    null,
  );
  assert.equal(totalDePedido([]), null);
});

test("dos monedas a la vez no dan un total", () => {
  assert.equal(
    totalDePedido([linea(), linea({ id: "p2", currency: "USD" })]),
    null,
  );
});

test("el mensaje lleva las líneas, las cantidades y el cierre de La Verde", () => {
  const texto = mensajePedido({
    negocio: "El Sabroso",
    lineas: [linea({ qty: 2, name: "Arroz con pollo" })],
  });
  assert.match(texto, /\*Pedido — El Sabroso\*/);
  assert.match(texto, /• Arroz con pollo x2 — 1200 CUP/);
  assert.match(texto, /\*Total: 2400\.00 CUP\*/);
  assert.ok(texto.endsWith("Pedido desde La Verde"));
});

test("sin total calculable el mensaje va sin la línea de total", () => {
  const texto = mensajePedido({
    negocio: "El Sabroso",
    lineas: [linea({ price: "A convenir" })],
  });
  assert.doesNotMatch(texto, /Total:/);
  assert.match(texto, /• Arroz con pollo x1 — A convenir CUP/);
});

test("el enlace lleva el número sin signos y el mensaje escapado", () => {
  assert.equal(
    hrefPedido("+53 5 123 4567", "uno\ndos"),
    "https://wa.me/5351234567?text=uno%0Ados",
  );
  assert.equal(hrefPedido("", "x"), "");
});

test("el número cubano se normaliza; lo que no lo es, no", () => {
  assert.equal(normalizarWhatsappCubano("+53 5 123 4567"), "+5351234567");
  assert.equal(normalizarWhatsappCubano("5351234567"), "+5351234567");
  assert.equal(normalizarWhatsappCubano("0053 51234567"), "+5351234567");
  assert.equal(normalizarWhatsappCubano("5 123 4567"), "+5351234567");
  assert.equal(normalizarWhatsappCubano("7 866 1234"), "+5378661234");
  assert.equal(normalizarWhatsappCubano("+53"), null);
  assert.equal(normalizarWhatsappCubano("llámame"), null);
  assert.equal(normalizarWhatsappCubano(""), null);
});
