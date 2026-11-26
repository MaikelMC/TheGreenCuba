import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesPlaceFilters, type FilterContext } from "@/lib/place-filters";
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
});

test("Populares incluye un top del mes", () => {
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
