import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesPlaceFilters, alternarFiltro, type FilterContext } from "@/lib/place-filters";
import type { UserPlace } from "@/lib/places-store";

const ahora = Date.now();

function lugar(extra: Partial<UserPlace> = {}): UserPlace {
  return {
    id: "x",
    slug: "x",
    name: "Negocio",
    category: "Cafetería",
    lat: 20,
    lng: -75,
    address: "",
    barrio: "Centro",
    description: "",
    schedule: "",
    payments: [],
    menu: [],
    offer: null,
    status: "active",
    pedidosWhatsapp: false,
    ...extra,
  } as UserPlace;
}

const contexto: FilterContext = {
  categoryLabel: null,
  populares: true,
  filters: new Set(),
  origin: null,
  now: new Date(ahora),
};

test("Populares deja fuera lo que no es top ni tiene oferta viva", () => {
  assert.equal(matchesPlaceFilters(lugar(), contexto), false);
});test("Populares incluye un top del mes", () => {
  assert.equal(matchesPlaceFilters(lugar({ topDelMes: true }), contexto), true);
});

test("Populares incluye una oferta viva", () => {
  const conOferta = lugar({
    ofertas: [
      {
        id: "o1",
        productoId: "p1",
        titulo: "2x1",
        inicia: ahora - 1000,
        termina: ahora + 60_000,
      },
    ],
  });
  assert.equal(matchesPlaceFilters(conOferta, contexto), true);
});

test("Populares no incluye una oferta caducada", () => {
  const caducada = lugar({
    ofertas: [
      {
        id: "o1",
        productoId: "p1",
        titulo: "2x1",
        inicia: ahora - 120_000,
        termina: ahora - 60_000,
      },
    ],
  });
  assert.equal(matchesPlaceFilters(caducada, contexto), false);
});

function conFiltro(filtro: string): FilterContext {
  return { ...contexto, populares: false, filters: new Set([filtro]) };
}

test("A domicilio solo deja los negocios con reparto activo", () => {
  const sinReparto = lugar();
  const conReparto = lugar({
    entrega: {
      costo: { modo: "gratis" },
      tiempo: { min: 20, max: 40 },
      domicilio: true,
    },
  });
  assert.equal(matchesPlaceFilters(sinReparto, conFiltro("domicilio")), false);
  assert.equal(matchesPlaceFilters(conReparto, conFiltro("domicilio")), true);
});

test("Acepta CUP mira los medios de pago reales", () => {
  assert.equal(matchesPlaceFilters(lugar(), conFiltro("cup")), false);
  assert.equal(
    matchesPlaceFilters(lugar({ payments: ["CUP", "USD"] }), conFiltro("cup")),
    true,
  );
});

test("Tiene planta usa la energía de respaldo", () => {
  assert.equal(matchesPlaceFilters(lugar(), conFiltro("planta")), false);
  assert.equal(
    matchesPlaceFilters(
      lugar({ energiaRespaldo: "planta" }),
      conFiltro("planta"),
    ),
    true,
  );
});

test("Con oferta exige una oferta viva", () => {
  assert.equal(matchesPlaceFilters(lugar(), conFiltro("oferta")), false);
  const viva = lugar({
    ofertas: [
      {
        id: "o1",
        productoId: "p1",
        titulo: "2x1",
        inicia: ahora - 1000,
        termina: ahora + 60_000,
      },
    ],
  });
  assert.equal(matchesPlaceFilters(viva, conFiltro("oferta")), true);
});

test("un filtro se enciende con un toque y se apaga con el segundo", () => {
  const vacio = new Set<string>();
  const encendido = alternarFiltro(vacio, "cup");

  assert.deepEqual([...encendido], ["cup"]);
  /* El conjunto que pinta la hoja no se muta: si se mutara, React no ver�a el
     cambio y el chip quedar�a apagado aunque el filtro estuviera dentro. */
  assert.equal(vacio.size, 0);

  const apagado = alternarFiltro(encendido, "cup");
  assert.deepEqual([...apagado], []);
});

test("los filtros se acumulan y cada uno se apaga por su cuenta", () => {
  const dos = alternarFiltro(alternarFiltro(new Set<string>(), "cup"), "oferta");

  assert.deepEqual([...dos].sort(), ["cup", "oferta"]);
  assert.deepEqual([...alternarFiltro(dos, "cup")], ["oferta"]);
  assert.deepEqual([...alternarFiltro(dos, "oferta")], ["cup"]);
});
