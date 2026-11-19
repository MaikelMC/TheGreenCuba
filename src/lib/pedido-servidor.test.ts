import assert from "node:assert/strict";
import { test } from "node:test";
import { revisarPedido } from "./pedido-servidor";
import type { LineaPedido } from "./pedido";
import type { UserPlaceMenuItem, UserPlaceOferta } from "./places-store";

const AHORA = Date.UTC(2026, 10, 18, 15, 0, 0);

function producto(extra: Partial<UserPlaceMenuItem> = {}): UserPlaceMenuItem {
  return { id: "p1", name: "Pizza Napolitana", description: "", price: "250", currency: "CUP", ...extra };
}

function linea(extra: Partial<LineaPedido> = {}): LineaPedido {
  return { id: "p1", name: "Pizza Napolitana", price: "250", currency: "CUP", qty: 2, ...extra };
}

test("con el precio bien no hay nada que revisar", () => {
  const r = revisarPedido([linea()], [producto()], [], AHORA);
  assert.deepEqual(r.motivos, []);
  assert.equal(r.lineas[0]!.price, "250");
  assert.equal(r.lineas[0]!.precioCliente, undefined, "sin cambio no se guarda");
});

test("el precio que se guarda es el del servidor, y se marca precio_cambio", () => {
  const r = revisarPedido([linea({ price: "100" })], [producto()], [], AHORA);
  assert.deepEqual(r.motivos, ["precio_cambio"]);
  assert.equal(r.lineas[0]!.price, "250");
  assert.equal(r.lineas[0]!.qty, 2, "la cantidad no se toca");
  assert.equal(r.lineas[0]!.precioCliente, "100", "y se guarda lo que vio el cliente");
});

test("una oferta viva manda sobre el precio de la carta", () => {
  const oferta: UserPlaceOferta = {
    id: "o1",
    productoId: "p1",
    titulo: "Rebaja",
    descuentoPct: 20,
    inicia: AHORA - 60_000,
    termina: AHORA + 60_000,
  };
  const r = revisarPedido([linea({ price: "200" })], [producto()], [oferta], AHORA);
  assert.deepEqual(r.motivos, []);
  assert.equal(r.lineas[0]!.price, "200");

  const caducada = { ...oferta, termina: AHORA - 1 };
  const r2 = revisarPedido([linea({ price: "200" })], [producto()], [caducada], AHORA);
  assert.deepEqual(r2.motivos, ["precio_cambio"], "una oferta vencida ya no vale");
  assert.equal(r2.lineas[0]!.price, "250");
});

test("nada se rechaza: inexistente, oculto y agotado se guardan marcados", () => {
  const carta = [
    producto({ id: "oc", name: "Oculto", oculto: true }),
    producto({ id: "ag", name: "Agotado", disponibilidad: "agotado", agotadoHasta: null }),
  ];
  const r = revisarPedido(
    [
      linea({ id: "no-esta", name: "Fantasma" }),
      linea({ id: "oc", name: "Oculto" }),
      linea({ id: "ag", name: "Agotado" }),
    ],
    carta,
    [],
    AHORA,
  );
  assert.deepEqual(new Set(r.motivos), new Set(["no_existe", "oculto", "agotado"]));
  assert.equal(r.lineas.length, 3, "todas las líneas se guardan");
});

test("un agotado con fecha vencida ya no se marca", () => {
  const r = revisarPedido(
    [linea()],
    [producto({ disponibilidad: "agotado", agotadoHasta: AHORA - 1 })],
    [],
    AHORA,
  );
  assert.deepEqual(r.motivos, []);
});

test("un producto sin precio numérico se marca sin_precio", () => {
  const r = revisarPedido([linea({ price: "100" })], [producto({ price: "100-400" })], [], AHORA);
  assert.deepEqual(r.motivos, ["sin_precio"]);
});

test("un carrito viejo con ids de antes encuentra el producto por su nombre", () => {
  const r = revisarPedido([linea({ id: "0", name: "pizza napolitana" })], [producto({ id: "estable" })], [], AHORA);
  assert.deepEqual(r.motivos, []);
  assert.equal(r.lineas[0]!.id, "estable");
});
