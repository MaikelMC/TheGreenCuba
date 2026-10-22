import assert from "node:assert/strict";
import { test } from "node:test";
import { cambiosDeCarta } from "./novedades";
import type { UserPlaceMenuItem } from "./places-store";

function producto(extra: Partial<UserPlaceMenuItem> = {}): UserPlaceMenuItem {
  return {
    name: "Café",
    description: "",
    price: "100",
    currency: "CUP",
    ...extra,
  };
}

test("un producto con id nuevo se detecta por id", () => {
  const { productosNuevos, cambiosPrecio } = cambiosDeCarta(
    [producto({ id: "a" })],
    [producto({ id: "a" }), producto({ id: "b", name: "Té" })],
  );
  assert.deepEqual(productosNuevos.map((p) => p.nombre), ["Té"]);
  assert.equal(cambiosPrecio.length, 0);
});

test("sin id se empareja por nombre, sin mayúsculas ni espacios", () => {
  const { productosNuevos } = cambiosDeCarta(
    [producto({ name: "  Café  " })],
    [producto({ name: "café" })],
  );
  assert.equal(productosNuevos.length, 0);
});

test("el precio que cambia sale con el de antes y el de ahora", () => {
  const { productosNuevos, cambiosPrecio } = cambiosDeCarta(
    [producto({ id: "a", price: "100" })],
    [producto({ id: "a", price: "120" })],
  );
  assert.equal(productosNuevos.length, 0);
  assert.deepEqual(cambiosPrecio[0], {
    productoId: "a",
    nombre: "Café",
    imagenUrl: undefined,
    precio: "120",
    precioAntes: "100",
  });
});

test("la carta sin cambios no genera nada", () => {
  const menu = [producto({ id: "a" }), producto({ id: "b", name: "Té" })];
  const { productosNuevos, cambiosPrecio } = cambiosDeCarta(menu, menu);
  assert.equal(productosNuevos.length, 0);
  assert.equal(cambiosPrecio.length, 0);
});

test("sin carta previa todo es nuevo, pero sin duplicados", () => {
  const { productosNuevos } = cambiosDeCarta(undefined, [
    producto({ id: "a" }),
    producto({ id: "a" }),
  ]);
  assert.equal(productosNuevos.length, 1);
});
