import assert from "node:assert/strict";
import { test } from "node:test";
import { buscarLugaresLocales } from "./busqueda-local";
import { indiceMenu } from "./productos";

test("sin conexión, el índice de la carta encuentra el producto", () => {
  const lugares = [
    {
      id: "a",
      name: "Yoyi Sabor",
      category: "Restaurante",
      menu: [],
      menuIndice: indiceMenu([
        { name: "Pizza Napolitana", description: "", price: "250", currency: "CUP" },
        { name: "Café con leche", description: "", price: "80", currency: "CUP" },
      ]),
    },
    { id: "b", name: "Otro sitio", category: "Bar", menu: [], menuIndice: "mojito" },
  ];

  assert.deepEqual(
    buscarLugaresLocales(lugares, "pizza").map((r) => r.id),
    ["a"],
  );
  assert.deepEqual(
    buscarLugaresLocales(lugares, "cafe").map((r) => r.id),
    ["a"],
    "sin acentos, como escribe la gente",
  );
});
