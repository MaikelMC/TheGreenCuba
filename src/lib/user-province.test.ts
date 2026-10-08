import assert from "node:assert/strict";
import { test } from "node:test";
import {
  placeInUserProvince,
  placeOutsideUserProvince,
} from "@/lib/user-province";
import type { UserPlace } from "@/lib/places-store";

/**
 * Las dos preguntas, y por qué no son la misma.
 *
 * `placeInUserProvince` afirma —«¿es de aquí?»— y no puede afirmar nada de una
 * ficha sin ciudad ni provincia: `false`. `placeOutsideUserProvince` es la que
 * usan los filtros duros —«¿lo oculto?»— y ahí un hueco no es una negación:
 * los negocios del alta del perfil llegaban sin provincia y desaparecían del
 * mapa de cualquiera con sesión y provincia guardada.
 */

function place(province: string, city = ""): UserPlace {
  return { province, city, name: "x", id: "x" } as unknown as UserPlace;
}

test("la pregunta positiva reconoce el negocio de la provincia", () => {
  assert.equal(placeInUserProvince(place("Santiago de Cuba"), "Santiago de Cuba"), true);
  assert.equal(placeInUserProvince(place("La Habana"), "Santiago de Cuba"), false);
});

test("la pregunta positiva no afirma nada de una ficha sin provincia", () => {
  assert.equal(placeInUserProvince(place(""), "Santiago de Cuba"), false);
  assert.equal(placeInUserProvince(place("", "Santiago de Cuba"), "Santiago de Cuba"), true);
});

test("no se oculta el negocio de otra provincia", () => {
  assert.equal(placeOutsideUserProvince(place("La Habana"), "Santiago de Cuba"), true);
  assert.equal(placeOutsideUserProvince(place("Santiago de Cuba"), "Santiago de Cuba"), false);
});

test("sin provincia no se oculta: un hueco no es una negación", () => {
  assert.equal(placeOutsideUserProvince(place(""), "Santiago de Cuba"), false);
  assert.equal(placeOutsideUserProvince(place("", ""), "Santiago de Cuba"), false);
});
