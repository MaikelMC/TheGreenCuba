import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatearBarrio,
  formatearDireccion,
  unirPartes,
} from "@/lib/texto-lugar";

test("el separador solo aparece entre dos valores que existen", () => {
  assert.equal(unirPartes(["Cafetería", "Centro"]), "Cafetería · Centro");
  assert.equal(unirPartes(["Cafetería", ""]), "Cafetería");
  assert.equal(unirPartes(["Cafetería", null, undefined]), "Cafetería");
  assert.equal(unirPartes(["", null]), "");
  assert.equal(unirPartes(["Calle 3", "Centro"], ", "), "Calle 3, Centro");
});

test("los barrios se escriben con mayúsculas normales y respetan partículas", () => {
  assert.equal(formatearBarrio("santa bárbara"), "Santa Bárbara");
  assert.equal(formatearBarrio("LOS MURROS DE ALTAMIRA"), "Los Murros de Altamira");
  assert.equal(formatearBarrio("centro de la ciudad"), "Centro de la Ciudad");
  assert.equal(formatearBarrio("  reparto   sueño  "), "Reparto Sueño");
});

test("los barrios conservan números romanos y apóstrofos", () => {
  assert.equal(formatearBarrio("carlos iii"), "Carlos III");
  assert.equal(formatearBarrio("d'luxe"), "D'Luxe");
});

test("un barrio vacío sigue vacío", () => {
  assert.equal(formatearBarrio(""), "");
  assert.equal(formatearBarrio(null), "");
  assert.equal(formatearBarrio("   "), "");
});

test("la dirección pierde el prefijo Dirección o Dir.", () => {
  assert.equal(formatearDireccion("Dirección: Calle 3 #12"), "Calle 3 #12");
  assert.equal(formatearDireccion("Dir. 3ra"), "3ra");
  assert.equal(formatearDireccion("DIRECCION - Calle 8"), "Calle 8");
  assert.equal(formatearDireccion("Dirección Calle 8"), "Calle 8");
});

test("la dirección no toca un «Dirección» que no está al inicio", () => {
  assert.equal(formatearDireccion("Calle 3, Dirección de Salud"), "Calle 3, Dirección de Salud");
  assert.equal(formatearDireccion("  Calle   3  "), "Calle 3");
});
