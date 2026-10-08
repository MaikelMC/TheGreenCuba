import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ENERGIA_ORDER,
  energiaParaIA,
  esEnergia,
  etiquetaEnergia,
  tieneRespaldo,
} from "@/lib/energia";

/**
 * La regla que importa: **`ninguna` y lo ausente se responden igual** —no hay
 * respaldo— pero solo `ninguna` es una decisión del dueño. Si esa diferencia se
 * pierde, una ficha sin rellenar empieza a anunciar «sin respaldo» como si
 * alguien lo hubiera comprobado.
 */

test("la planta y el inversor cuentan como respaldo", () => {
  assert.equal(tieneRespaldo("planta"), true);
  assert.equal(tieneRespaldo("inversor"), true);
  assert.equal(tieneRespaldo("ambas"), true);
});

test("«ninguna» y lo ausente no tienen respaldo", () => {
  assert.equal(tieneRespaldo("ninguna"), false);
  assert.equal(tieneRespaldo(null), false);
  assert.equal(tieneRespaldo(undefined), false);
});

test("solo se pinta etiqueta cuando hay respaldo", () => {
  assert.equal(etiquetaEnergia("planta"), "Con planta");
  assert.equal(etiquetaEnergia("inversor"), "Con inversor");
  assert.equal(etiquetaEnergia("ambas"), "Con planta e inversor");
  /* Explícito y ausente: los dos se callan. */
  assert.equal(etiquetaEnergia("ninguna"), null);
  assert.equal(etiquetaEnergia(null), null);
});

test("a la IA no se le cuenta «ninguna»", () => {
  /* Callarlo no es un detalle: decirle al modelo que un lugar NO tiene corriente
     en una consulta que busca sitios con corriente lo descarta dos veces, y
     además lo nombra en el resumen. */
  assert.equal(energiaParaIA("ninguna"), null);
  assert.equal(energiaParaIA(null), null);
  assert.equal(energiaParaIA("planta"), "planta eléctrica");
  assert.equal(energiaParaIA("ambas"), "planta eléctrica e inversor");
});

test("la frontera reconoce los cuatro valores y nada más", () => {
  for (const valor of ENERGIA_ORDER) assert.equal(esEnergia(valor), true);
  for (const otro of ["PLANTA", "planta ", "", "solar", null, undefined, 1, {}]) {
    assert.equal(esEnergia(otro), false, `no debería ser válido: ${otro}`);
  }
});
