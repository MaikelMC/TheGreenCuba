import assert from "node:assert/strict";
import { test } from "node:test";
import {
  campoResuelto,
  conservarEntreCalles,
  ordenarSugerencias,
  resolverNominatim,
  type GeocodeSuggestion,
} from "@/lib/map/geocode";

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

test("el reverse copia los nombres de OSM sin recortar números", () => {
  /* Antes se quitaban los dígitos iniciales: «5ta Avenida» salía «ta Avenida». */
  const r = resolverNominatim({
    country_code: "cu",
    road: "5ta Avenida",
    suburb: "30 de Noviembre",
    city: "La Habana",
  });

  assert.equal(r?.street, "5ta Avenida");
  assert.equal(r?.barrio, "30 de Noviembre");
  assert.equal(r?.address, "5ta Avenida, 30 de Noviembre, La Habana");
});

test("el reverse no inventa entre-calles ni sale de Cuba", () => {
  const r = resolverNominatim({ country_code: "cu", road: "Calle Heredia", city: "Santiago de Cuba" });
  assert.equal(r?.between, undefined);
  assert.ok(!r?.address.includes("e/"));
  assert.equal(resolverNominatim({ country_code: "us", road: "Main St" }), null);
});

test("las entre-calles escritas siguen si el pin se mueve en la misma calle", () => {
  const anterior = {
    address: "Calle Heredia, e/ San Pedro y Santo Tomás, Centro",
    barrio: "Centro",
    label: "",
    street: "Calle Heredia",
    between: "San Pedro y Santo Tomás",
  };
  const misma = resolverNominatim({ country_code: "cu", road: "Calle Heredia", suburb: "Centro" });
  const otra = resolverNominatim({ country_code: "cu", road: "Calle Aguilera", suburb: "Centro" });

  assert.equal(
    conservarEntreCalles(misma, anterior)?.address,
    "Calle Heredia, e/ San Pedro y Santo Tomás, Centro",
  );
  // En otra calle las entre-calles de la anterior ya no valen.
  assert.equal(conservarEntreCalles(otra, anterior)?.address, "Calle Aguilera, Centro");
});

test("el relleno automático sigue al pin y lo escrito a mano no se pisa", () => {
  // Vacío o relleno automático anterior: se sustituye.
  assert.equal(campoResuelto("", "Calle Nueva", undefined), "Calle Nueva");
  assert.equal(campoResuelto("Calle Vieja", "Calle Nueva", "Calle Vieja"), "Calle Nueva");
  // Sin resultado para el punto nuevo: el relleno viejo se vacía.
  assert.equal(campoResuelto("Calle Vieja", undefined, "Calle Vieja"), "");
  // Escrito a mano (o guardado de antes): se queda.
  assert.equal(campoResuelto("Calle 12 #45", "Calle Nueva", "Calle Vieja"), "Calle 12 #45");
  assert.equal(campoResuelto("Calle 12 #45", undefined, undefined), "Calle 12 #45");
});
