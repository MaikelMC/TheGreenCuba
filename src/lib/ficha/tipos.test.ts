import assert from "node:assert/strict";
import { test } from "node:test";
import {
  esTipoNegocio,
  familiaDe,
  normalizarModulos,
  posicionPortada,
  TIPOS_NEGOCIO,
} from "@/lib/ficha/tipos";

test("los 16 tipos del alta son válidos", () => {
  assert.equal(TIPOS_NEGOCIO.length, 16);
  for (const tipo of TIPOS_NEGOCIO) assert.equal(esTipoNegocio(tipo), true);
  assert.equal(esTipoNegocio("cafeteria_restaurante"), false);
  assert.equal(esTipoNegocio(null), false);
});

test("familiaDe devuelve la familia correcta", () => {
  assert.equal(familiaDe("cafeteria"),        "cafeteria_restaurante");
  assert.equal(familiaDe("restaurante"),      "cafeteria_restaurante");
  assert.equal(familiaDe("bar"),              "cafeteria_restaurante");
  assert.equal(familiaDe("comida_domicilio"), "comida_domicilio");
  assert.equal(familiaDe("dulceria"),         "comida_domicilio");
  assert.equal(familiaDe("mipyme"),           "tienda_mipyme");
  assert.equal(familiaDe("ropa"),             "tienda_mipyme");
  assert.equal(familiaDe("ferreteria"),       "tienda_mipyme");
  assert.equal(familiaDe("belleza"),          "servicios");
  assert.equal(familiaDe("otro"),             "servicios");
});

test("los módulos se desduplican y se descarta lo desconocido", () => {
  assert.deepEqual(
    normalizarModulos(["domicilio", "local", "domicilio", "inventado"]),
    ["domicilio", "local"],
  );
  assert.deepEqual(normalizarModulos("domicilio"), []);
  assert.deepEqual(normalizarModulos(undefined), []);
});

test("el encuadre se traduce a object-position", () => {
  assert.equal(posicionPortada("arriba"), "center top");
  assert.equal(posicionPortada("abajo"), "center bottom");
  assert.equal(posicionPortada(null), "center center");
});
