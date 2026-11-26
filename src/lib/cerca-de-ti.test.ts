import assert from "node:assert/strict";
import { test } from "node:test";
import { ordenarCercaDeTi, type LugarOrdenable } from "@/lib/cerca-de-ti";

function lugar(
  nombre: string,
  abierto: boolean | null,
  distanceM: number | null,
  proximaApertura: number | null = null,
): LugarOrdenable & { nombre: string } {
  return { nombre, abierto, distanceM, proximaApertura };
}

test("los abiertos van primero y por distancia", () => {
  const orden = ordenarCercaDeTi([
    lugar("cerrado", false, 100, 9_000),
    lugar("abierto lejos", true, 900),
    lugar("abierto cerca", true, 200),
  ]);
  assert.deepEqual(
    orden.map((l) => l.nombre),
    ["abierto cerca", "abierto lejos", "cerrado"],
  );
});

test("los cerrados se ordenan por lo que abre antes y luego por distancia", () => {
  const orden = ordenarCercaDeTi([
    lugar("abre tarde", false, 100, 20_000),
    lugar("abre pronto lejos", false, 900, 8_000),
    lugar("abre pronto cerca", false, 200, 8_000),
  ]);
  assert.deepEqual(
    orden.map((l) => l.nombre),
    ["abre pronto cerca", "abre pronto lejos", "abre tarde"],
  );
});

test("los de estado desconocido van al final aunque estén cerca", () => {
  const orden = ordenarCercaDeTi([
    lugar("sin horario", null, 10),
    lugar("cerrado", false, 900, 8_000),
    lugar("abierto", true, 1_000),
  ]);
  assert.deepEqual(
    orden.map((l) => l.nombre),
    ["abierto", "cerrado", "sin horario"],
  );
});

test("sin próxima apertura conocida, la distancia desempata", () => {
  const orden = ordenarCercaDeTi([
    lugar("cerrado lejos", false, 900, null),
    lugar("cerrado cerca", false, 200, null),
  ]);
  assert.deepEqual(
    orden.map((l) => l.nombre),
    ["cerrado cerca", "cerrado lejos"],
  );
});

test("el orden es estable y no muta la lista original", () => {
  const original = [lugar("a", null, null), lugar("b", null, null)];
  const orden = ordenarCercaDeTi(original);
  assert.deepEqual(
    orden.map((l) => l.nombre),
    ["a", "b"],
  );
  assert.deepEqual(
    original.map((l) => l.nombre),
    ["a", "b"],
  );
});
