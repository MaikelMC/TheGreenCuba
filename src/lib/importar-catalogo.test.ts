import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseCsv,
  parsearCatalogo,
  precioNumerico,
  resumir,
  validarFilas,
  type FilaCruda,
} from "@/lib/importar-catalogo";

/**
 * Lo que se comprueba aquí es el parser y las reglas de validación —lo único
 * con ramas de verdad—. El resto de la importación es una escritura y no hay
 * nada que probar sin base de datos.
 */

test("detecta el punto y coma como separador", () => {
  const filas = parseCsv("nombre;categoria\nAgua;Bebidas");
  assert.deepEqual(filas, [
    ["nombre", "categoria"],
    ["Agua", "Bebidas"],
  ]);
});

test("respeta las comas dentro de las comillas", () => {
  const filas = parseCsv('nombre,descripcion\nMojito,"ron, lima y soda"');
  assert.equal(filas[1]?.[1], "ron, lima y soda");
});

test("desescapa las comillas dobles", () => {
  const filas = parseCsv('nombre\n"La ""especial"""');
  assert.equal(filas[1]?.[0], 'La "especial"');
});

test("tolera el BOM y los saltos CRLF, y no cuenta la fila vacía final", () => {
  const { filas, error } = parsearCatalogo(
    "\uFEFFnombre,categoria,precio\r\nAgua,Bebidas,2\r\n",
  );
  assert.equal(error, undefined);
  assert.equal(filas.length, 1);
  assert.equal(filas[0]?.nombre, "Agua");
});

test("sin columna nombre, el archivo entero se rechaza", () => {
  const { error } = parsearCatalogo("cantidad,categoria\n1,Bebidas");
  assert.match(error ?? "", /nombre/);
});

test("«producto» y «precio» valen como cabecera, con tildes y todo", () => {
  const { filas } = parsearCatalogo('Producto,Categoría,Precio\nAgua,Bebidas,"2,5"');
  assert.equal(filas[0]?.nombre, "Agua");
  assert.equal(filas[0]?.moneda, "");
  assert.equal(precioNumerico(filas[0]?.precio ?? ""), 2.5);
});

test("el precio acepta coma decimal y rechaza símbolos", () => {
  assert.equal(precioNumerico("12,50"), 12.5);
  assert.equal(precioNumerico("0"), 0);
  assert.equal(precioNumerico("$12"), null);
  assert.equal(precioNumerico("3-5"), null);
});

const cruda = (nombre: string, categoria: string, precio = "1"): FilaCruda => ({
  numero: 2,
  nombre,
  categoria,
  descripcion: "",
  precio,
  moneda: "",
});

test("la moneda vacía cae en CUP y la inventada es error", () => {
  const [ok] = validarFilas([cruda("Agua", "Bebidas")], []);
  assert.equal(ok?.moneda, "CUP");
  assert.equal(ok?.estado, "nuevo");

  const [mal] = validarFilas([{ ...cruda("Agua", "Bebidas"), moneda: "GBP" }], []);
  assert.equal(mal?.estado, "error");
  assert.match(mal?.motivo ?? "", /moneda/i);
});

test("detecta duplicados contra lo que ya hay y dentro del archivo", () => {
  const existentes = [{ nombre: "Agua", categoria: "Bebidas" }];
  const filas = validarFilas(
    [
      cruda("Agua", "bebidas"), // contra el existente, sin tildes ni mayúsculas
      cruda("Arroz", "Comida"),
      cruda("Arroz", "comida"), // dentro del archivo
    ],
    existentes,
  );

  assert.equal(filas[0]?.estado, "duplicado");
  assert.equal(filas[1]?.estado, "nuevo");
  assert.equal(filas[2]?.estado, "duplicado");
  assert.deepEqual(resumir(filas), { nuevos: 1, duplicados: 2, errores: 0 });
});

test("adopta la grafía de categoría que ya usa el negocio", () => {
  const existentes = [{ nombre: "Otra cosa", categoria: "Bebidas" }];
  const [fila] = validarFilas([cruda("Agua", "bebidas")], existentes);
  assert.equal(fila?.categoria, "Bebidas");
});

test("la descripción puede ir vacía y los largos se cortan", () => {
  const [ok] = validarFilas([cruda("Agua", "Bebidas")], []);
  assert.equal(ok?.estado, "nuevo");

  const [largo] = validarFilas([cruda("A".repeat(81), "Bebidas")], []);
  assert.equal(largo?.estado, "error");
});
