import assert from "node:assert/strict";
import { test } from "node:test";
import type { UserPlaceMenuItem } from "./places-store";
import {
  convertirPrecio,
  esIdPosicional,
  filaDeItem,
  planMigracion,
  type NegocioConMenu,
} from "./productos";

function item(extra: Partial<UserPlaceMenuItem> = {}): UserPlaceMenuItem {
  return { name: "Café", description: "", price: "250", currency: "CUP", ...extra };
}

/** Ids predecibles para las pruebas: `n1`, `n2`… */
function contador() {
  let n = 0;
  return () => `n${++n}`;
}

/* ── convertirPrecio ─────────────────────────────────────────────────── */

test("convierte las cifras inequívocas", () => {
  assert.deepEqual(convertirPrecio("250", "CUP"), { precio: 250, tipoPrecio: "fijo" });
  assert.deepEqual(convertirPrecio("3.50", "USD"), { precio: 3.5, tipoPrecio: "fijo" });
  assert.deepEqual(convertirPrecio("3,50", "USD"), { precio: 3.5, tipoPrecio: "fijo" });
  assert.deepEqual(convertirPrecio(" 3 USD ", "USD"), { precio: 3, tipoPrecio: "fijo" });
  assert.deepEqual(convertirPrecio("3usd", "USD"), { precio: 3, tipoPrecio: "fijo" });
});

test("los precios ambiguos se quedan sin número", () => {
  assert.equal(convertirPrecio("3–5", "USD").precio, null, "rango");
  assert.equal(convertirPrecio("3-5 USD", "USD").precio, null, "rango con moneda");
  assert.equal(convertirPrecio("100 a 400", "CUP").precio, null, "rango con «a»");
  assert.equal(convertirPrecio("Desde 8", "USD").precio, null, "desde");
  assert.equal(convertirPrecio("A convenir", "CUP").precio, null, "sin cifra");
  assert.equal(convertirPrecio("", "CUP").precio, null, "vacío");
  assert.equal(convertirPrecio("1.200", "CUP").precio, null, "¿mil doscientos o uno con dos?");
  assert.equal(convertirPrecio("1,200", "CUP").precio, null, "lo mismo con coma");
  assert.equal(convertirPrecio("3 USD", "CUP").precio, null, "moneda distinta");
  assert.equal(convertirPrecio("3$", "USD").precio, null, "el $ no dice qué moneda");
  assert.equal(convertirPrecio("250 por persona", "CUP").precio, null, "frase");
});

test("el tipo se deduce del texto, y el guardado manda", () => {
  assert.equal(convertirPrecio("Desde 8", "USD").tipoPrecio, "desde");
  assert.equal(convertirPrecio("3–5", "USD").tipoPrecio, "desde");
  assert.equal(convertirPrecio("A convenir", "CUP").tipoPrecio, "consultar");
  assert.equal(convertirPrecio("", "CUP").tipoPrecio, "consultar");
  assert.equal(convertirPrecio("1.200", "CUP").tipoPrecio, "fijo");
  assert.deepEqual(convertirPrecio("8", "USD", "desde"), { precio: 8, tipoPrecio: "desde" });
});

test("esIdPosicional", () => {
  assert.equal(esIdPosicional(undefined), true);
  assert.equal(esIdPosicional(""), true);
  assert.equal(esIdPosicional("0"), true);
  assert.equal(esIdPosicional("17"), true);
  assert.equal(esIdPosicional("new-1760000000000"), false);
  assert.equal(esIdPosicional("E4gQYp3LOVI-"), false);
});

/* ── filaDeItem ──────────────────────────────────────────────────────── */

test("la fila no pierde ningún campo del jsonb", () => {
  const fila = filaDeItem(
    item({
      id: "p1",
      category: "Bebidas",
      image: "https://bucket/x.webp",
      tag: "Popular",
      disponibilidad: "agotado",
      agotadoHasta: 1_760_000_000_000,
      oculto: true,
      destacado: true,
      stock: 4,
      duracionMin: 30,
      externalId: "erp-1",
      importacionId: "imp-1",
      tipoPrecio: "desde",
    }),
    "negocio-1",
    3,
    "p1",
  );

  assert.deepEqual(fila, {
    id: "p1",
    placeId: "negocio-1",
    orden: 3,
    categoria: "Bebidas",
    nombre: "Café",
    descripcion: "",
    imagen: "https://bucket/x.webp",
    tag: "Popular",
    precioTexto: "250",
    precio: "250.00",
    moneda: "CUP",
    tipoPrecio: "desde",
    disponibilidad: "agotado",
    agotadoHasta: new Date(1_760_000_000_000),
    oculto: true,
    destacado: true,
    stock: 4,
    duracionMin: 30,
    externalId: "erp-1",
    importacionId: "imp-1",
  });
});

test("la fila vacía las cadenas en blanco y pone moneda por defecto", () => {
  const fila = filaDeItem(item({ currency: "", category: "  ", image: "" }), "n", 0, "x");
  assert.equal(fila.moneda, "MLC");
  assert.equal(fila.categoria, null);
  assert.equal(fila.imagen, null);
  assert.equal(fila.disponibilidad, "disponible");
});

/* ── planMigracion ───────────────────────────────────────────────────── */

test("los ids estables se conservan y los posicionales se reasignan", () => {
  const negocios: NegocioConMenu[] = [
    {
      id: "a",
      name: "A",
      menu: [item({ id: "estable-1" }), item({ id: "1" }), item({ name: "Sin id" })],
    },
  ];

  const plan = planMigracion(negocios, [], [], contador());
  const [a] = plan.negocios;

  assert.deepEqual(
    a!.filas.map((f) => f.id),
    ["estable-1", "n1", "n2"],
  );
  assert.deepEqual(
    a!.reasignados.map((r) => [r.antes, r.despues]),
    [["1", "n1"], ["2", "n2"]],
    "el que no tenía id usaba su índice, como hacía `conIds`",
  );
  assert.equal(a!.cambiaMenu, true);
  assert.deepEqual(a!.menu.map((m) => m.id), ["estable-1", "n1", "n2"]);
});

test("el mismo índice en dos negocios no choca en la tabla", () => {
  const plan = planMigracion(
    [
      { id: "a", name: "A", menu: [item({ id: "0" })] },
      { id: "b", name: "B", menu: [item({ id: "0" })] },
    ],
    [],
    [],
    contador(),
  );
  const ids = plan.negocios.flatMap((n) => n.filas.map((f) => f.id));
  assert.equal(new Set(ids).size, 2);
});

test("un id estable repetido en otro negocio se reasigna allí", () => {
  const plan = planMigracion(
    [
      { id: "a", name: "A", menu: [item({ id: "dup" })] },
      { id: "b", name: "B", menu: [item({ id: "dup" })] },
    ],
    [{ id: "of-b", negocioId: "b", productoId: "dup" }],
    [],
    contador(),
  );

  assert.equal(plan.negocios[0]!.filas[0]!.id, "dup", "el primero se lo queda");
  assert.equal(plan.negocios[1]!.filas[0]!.id, "n1");
  assert.equal(plan.negocios[1]!.reasignados[0]!.motivo, "duplicado");
  assert.deepEqual(plan.remapeoOfertas, [{ id: "of-b", de: "dup", a: "n1" }]);
});

test("las ofertas y novedades se remapean dentro de su negocio", () => {
  const plan = planMigracion(
    [
      { id: "a", name: "A", menu: [item({ id: "estable" }), item({ id: "1" })] },
      { id: "b", name: "B", menu: [item({ id: "1" })] },
    ],
    [
      { id: "of-a", negocioId: "a", productoId: "1" },
      { id: "of-a2", negocioId: "a", productoId: "estable" },
      { id: "of-b", negocioId: "b", productoId: "1" },
    ],
    [{ id: "nov-a", negocioId: "a", productoId: "1" }],
    contador(),
  );

  assert.deepEqual(plan.remapeoOfertas, [
    { id: "of-a", de: "1", a: "n1" },
    { id: "of-b", de: "1", a: "n2" },
  ]);
  assert.deepEqual(plan.remapeoNovedades, [{ id: "nov-a", de: "1", a: "n1" }]);
  assert.deepEqual(plan.ofertasHuerfanas, []);
});

test("las ofertas que no apuntan a nada salen como huérfanas", () => {
  const plan = planMigracion(
    [{ id: "a", name: "A", menu: [item({ id: "vivo" })] }],
    [{ id: "of-x", negocioId: "a", productoId: "borrado" }],
    [],
    contador(),
  );
  assert.deepEqual(plan.ofertasHuerfanas, [
    { id: "of-x", negocioId: "a", productoId: "borrado" },
  ]);
});

test("los precios sin número salen en el informe con su texto", () => {
  const plan = planMigracion(
    [
      {
        id: "a",
        name: "A",
        menu: [
          item({ id: "x1", price: "250" }),
          item({ id: "x2", price: "3–5", name: "Rango" }),
          item({ id: "x3", price: "A convenir", name: "Libre" }),
        ],
      },
    ],
    [],
    [],
    contador(),
  );
  assert.deepEqual(
    plan.sinPrecio.map((s) => [s.nombre, s.texto, s.tipo]),
    [
      ["Rango", "3–5", "desde"],
      ["Libre", "A convenir", "consultar"],
    ],
  );
});

test("la segunda pasada, con los ids ya escritos, no reasigna nada", () => {
  const negocios: NegocioConMenu[] = [
    { id: "a", name: "A", menu: [item({ id: "0" }), item({})] },
  ];
  const primera = planMigracion(negocios, [], [], contador());
  /* Lo que `--aplicar` deja en `places.menu`. */
  const segunda = planMigracion(
    [{ id: "a", name: "A", menu: primera.negocios[0]!.menu }],
    [],
    [],
    () => {
      throw new Error("no debería generar ids nuevos");
    },
  );

  assert.equal(segunda.negocios[0]!.cambiaMenu, false);
  assert.deepEqual(segunda.negocios[0]!.filas, primera.negocios[0]!.filas);
});
