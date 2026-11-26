import assert from "node:assert/strict";
import { test } from "node:test";
import { detectarTiposSospechosos } from "@/lib/admin-tipos-sospechosos";

test("una pizzería en Cafetería es sospechosa", () => {
  const [sospecha] = detectarTiposSospechosos([
    { id: "pqtt", name: "PQTT? Pizzería", category: "Cafetería" },
  ]);
  assert.equal(sospecha?.sugerida, "Restaurante");
  assert.equal(sospecha?.confianza, 2);
  assert.match(sospecha?.motivo ?? "", /Cafetería/);
});

test("una pizzería ya marcada como Restaurante no genera ruido", () => {
  const lista = detectarTiposSospechosos([
    { id: "p", name: "Pizzería La Esquina", category: "Restaurante" },
  ]);
  assert.deepEqual(lista, []);
});

test("una barbería en Restaurante es sospechosa", () => {
  const [sospecha] = detectarTiposSospechosos([
    { id: "b", name: "elitoBarber", category: "Restaurante" },
  ]);
  assert.equal(sospecha?.sugerida, "Servicio");
});

test("«bar» no se cuela dentro de «barbería»", () => {
  const lista = detectarTiposSospechosos([
    { id: "b", name: "Barbería El Sol", category: "Servicio" },
  ]);
  assert.deepEqual(lista, []);
});

test("una cafetería en Restaurante no es sospechosa: son compatibles", () => {
  const lista = detectarTiposSospechosos([
    { id: "c", name: "Café Catedral", category: "Restaurante" },
  ]);
  assert.deepEqual(lista, []);
});

test("dos productos de pizzería bastan aunque el nombre no lo diga", () => {
  const [sospecha] = detectarTiposSospechosos([
    {
      id: "r",
      name: "El Rincón",
      category: "Cafetería",
      productos: ["Pizza muzzarella", "Pizza de pepperoni"],
    },
  ]);
  assert.equal(sospecha?.sugerida, "Restaurante");
  assert.equal(sospecha?.confianza, 2);
});

test("un solo producto no basta para acusar a un negocio", () => {
  const lista = detectarTiposSospechosos([
    { id: "t", name: "Tienda La Esquina", category: "Tienda", productos: ["Café molido"] },
  ]);
  assert.deepEqual(lista, []);
});

test("comida a domicilio es compatible con un restaurante", () => {
  const lista = detectarTiposSospechosos([
    {
      id: "y",
      name: "Yoyi Sabor",
      category: "Comida a domicilio",
      productos: ["Tacos de res", "Tacos de atún"],
    },
  ]);
  assert.deepEqual(lista, []);
});

test("las tildes y mayúsculas no cambian la detección", () => {
  const [sospecha] = detectarTiposSospechosos([
    { id: "x", name: "PIZZERÍA CENTRAL", category: "Cafetería" },
  ]);
  assert.equal(sospecha?.sugerida, "Restaurante");
});
