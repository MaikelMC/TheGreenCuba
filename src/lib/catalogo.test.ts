import assert from "node:assert/strict";
import { test } from "node:test";
import { aGuardar, conIds, huella } from "./catalogo";
import type { UserPlaceMenuItem } from "./places-store";

/** Un producto con **todos** los campos llenos: así, si alguno se cae al
    guardar, la prueba lo ve. Es el caso que no se puede perder. */
function completo(extra: Partial<UserPlaceMenuItem> = {}): UserPlaceMenuItem {
  return {
    id: "p1",
    name: "Café con leche",
    description: "Café cubano con leche vaporizada",
    price: "350",
    currency: "CUP",
    tag: "Popular",
    category: "Bebidas",
    image: "https://bucket.example/places/x/menu/foto.webp",
    disponibilidad: "agotado",
    agotadoHasta: 1_760_000_000_000,
    importacionId: "imp-9",
    ...extra,
  };
}

test("conIds rellena solo los que no traen id", () => {
  const { id: _sinId, ...viejo } = completo();
  const menu = conIds([viejo as UserPlaceMenuItem, completo({ id: "p9" })]);

  assert.equal(menu[0]!.id, "0", "el producto viejo toma el índice");
  assert.equal(menu[1]!.id, "p9", "el que ya tenía id lo conserva");
});

test("conIds no toca el resto de los campos", () => {
  const { id: _sinId, ...viejo } = completo();
  const [primero] = conIds([viejo as UserPlaceMenuItem]);

  assert.deepEqual(
    { ...primero, id: undefined },
    { ...viejo, id: undefined },
    "rellenar el id no puede cambiar nada más",
  );
});

test("guardar no pierde ningún campo", () => {
  const [guardado] = aGuardar([completo()]);

  assert.equal(guardado!.name, "Café con leche");
  assert.equal(guardado!.description, "Café cubano con leche vaporizada");
  assert.equal(guardado!.price, "350");
  assert.equal(guardado!.currency, "CUP");
  assert.equal(guardado!.tag, "Popular", "la chapita que puso la administración");
  assert.equal(guardado!.category, "Bebidas");
  assert.equal(guardado!.image, "https://bucket.example/places/x/menu/foto.webp");
  assert.equal(guardado!.disponibilidad, "agotado", "el «Hoy hay»");
  assert.equal(guardado!.agotadoHasta, 1_760_000_000_000);
  assert.equal(guardado!.importacionId, "imp-9", "sin esto no hay «Deshacer importación»");
});

test("guardar vacía la categoría y la foto en vez de dejar cadenas vacías", () => {
  const [guardado] = aGuardar([
    completo({ category: "   ", image: "" }),
  ]);

  assert.equal(guardado!.category, undefined, "«   » no es una categoría");
  assert.equal(guardado!.image, undefined);
});

test("guardar recorta el nombre y la categoría", () => {
  const [guardado] = aGuardar([
    completo({ name: "  Café  ", category: "  Bebidas  " }),
  ]);

  assert.equal(guardado!.name, "Café");
  assert.equal(guardado!.category, "Bebidas");
});

test("guardar deja el id como estaba", () => {
  const [guardado] = aGuardar([completo({ id: "new-1760000000000" })]);

  assert.equal(guardado!.id, "new-1760000000000");
});

test("la vuelta completa —cargar, guardar, volver a cargar— no cambia la carta", () => {
  const guardada = [completo(), completo({ id: "p2", currency: "USD" })];
  /* Lo que la base devuelve tras el `PATCH` es lo que se mandó. */
  const recargada = conIds(aGuardar(conIds(guardada)));

  assert.equal(
    huella(recargada),
    huella(conIds(guardada)),
    "cargar y guardar sin tocar nada tiene que dar la misma carta",
  );
});

test("huella distingue un cambio en cada campo que se edita", () => {
  const base = conIds([completo()]);
  const antes = huella(base);

  const ediciones: Partial<UserPlaceMenuItem>[] = [
    { name: "Café solo" },
    { description: "Otra cosa" },
    { price: "400" },
    { currency: "USD" },
    { category: "Comidas" },
    { image: "https://bucket.example/otra.webp" },
  ];

  for (const edicion of ediciones) {
    const campo = Object.keys(edicion)[0]!;
    assert.notEqual(
      huella([{ ...base[0]!, ...edicion }]),
      antes,
      `cambiar «${campo}» tiene que marcar la carta como sin guardar`,
    );
  }
});

test("huella marca la carta como sin guardar al cambiar el «Hoy hay»", () => {
  const base = conIds([completo({ disponibilidad: "disponible", agotadoHasta: null })]);

  assert.notEqual(
    huella([{ ...base[0]!, disponibilidad: "agotado" }]),
    huella(base),
  );
});

test("huella no se inmuta por campos que esta pantalla no edita", () => {
  const base = conIds([completo()]);

  assert.equal(huella([{ ...base[0]!, tag: "Nuevo" }]), huella(base));
  assert.equal(huella([{ ...base[0]!, importacionId: "otra" }]), huella(base));
});

test("una carta vieja sin ids no nace marcada como sin guardar", () => {
  const { id: _sinId, ...viejo } = completo();
  const menu = [viejo as UserPlaceMenuItem];

  assert.equal(
    huella(conIds(menu)),
    huella(conIds(menu)),
    "los dos lados de la comparación pasan por conIds, o la barra de guardar sale sola",
  );
});
