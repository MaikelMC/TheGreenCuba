import assert from "node:assert/strict";
import { test } from "node:test";
import { ordenarSugerencias, type GeocodeSuggestion } from "@/lib/map/geocode";

/** Centro de Santiago de Cuba: el usuario parado ahí. */
const santiago = { lat: 20.0247, lng: -75.8267 };

function calle(street: string, lat: number, lng: number): GeocodeSuggestion {
  return { street, lat, lng, label: street };
}

test("la calle más cercana al usuario va primero", () => {
  /* Photon puede devolver antes el tramo de otra zona de la provincia; la
     lista tiene que enseñar primero el que está al lado del usuario. */
  const lejos = calle("Calle Heredia", 20.16, -75.9);
  const cerca = calle("Calle Heredia", 20.025, -75.827);

  const orden = ordenarSugerencias([lejos, cerca], {
    palabras: ["heredia"],
    cerca: santiago,
  });

  assert.equal(orden[0]!.lat, cerca.lat);
  assert.equal(orden[1]!.lat, lejos.lat);
});

test("la coincidencia exacta gana a un prefijo aunque esté más lejos", () => {
  const prefijo = calle("Calle Martínez", 20.0248, -75.8268);
  const exacta = calle("Calle Martí", 20.1, -75.9);

  const orden = ordenarSugerencias([prefijo, exacta], {
    palabras: ["marti"],
    cerca: santiago,
  });

  assert.deepEqual(
    orden.map((s) => s.street),
    ["Calle Martí", "Calle Martínez"],
  );
});

test("la calle entera va antes que un portal suyo en el mismo punto", () => {
  const portal = { ...calle("Calle Heredia", 20.025, -75.827), housenumber: "12" };
  const via = calle("Calle Heredia", 20.025, -75.827);

  const orden = ordenarSugerencias([portal, via], {
    palabras: ["heredia"],
    cerca: santiago,
  });

  assert.equal(orden[0]!.housenumber, undefined);
});

test("sin ubicación de referencia se respeta el orden de Photon", () => {
  const primera = calle("Calle Heredia", 20.16, -75.9);
  const segunda = calle("Calle Heredia", 20.025, -75.827);

  const orden = ordenarSugerencias([primera, segunda], { palabras: ["heredia"] });

  assert.equal(orden[0]!.lat, primera.lat);
});
