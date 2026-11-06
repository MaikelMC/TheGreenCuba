import assert from "node:assert/strict";
import test from "node:test";
import type { UserPlace } from "@/lib/places-store";
import { userPlaceToPlaceData } from "./place-data";

function basePlace(overrides: Partial<UserPlace> = {}): UserPlace {
  return {
    id: "negocio-1",
    slug: "negocio-1",
    name: "Café de prueba",
    category: "Cafetería",
    lat: 23.1,
    lng: -82.3,
    address: "Calle 1",
    barrio: "Centro",
    description: "",
    schedule: "",
    payments: [],
    menu: [],
    offer: null,
    status: "active",
    pedidosWhatsapp: true,
    isActive: true,
    reviewStatus: "approved",
    isBoosted: false,
    boostExpiresAt: "",
    createdAt: 1,
    ...overrides,
  };
}

test("los campos nuevos sobreviven a UserPlace → PlaceData", () => {
  const place = userPlaceToPlaceData(
    basePlace({
      shortDescription: "Tostado propio",
      tipoNegocio: "cafeteria",
      modulosActivos: ["local", "domicilio"],
      atributos: ["wifi", "terraza"],
      colorMarca: "#0F7A41",
      portadaEncuadre: "arriba",
      acciones: {
        fila: ["como_llegar", "whatsapp"],
        barra: ["pedir", "como_llegar"],
      },
      horario: { semana: { lun: [{ abre: "08:00", cierra: "18:00" }] } },
      cerradoMensaje: "Cerrado por inventario",
      entrega: { costo: { modo: "gratis" }, tiempo: { min: 20, max: 40 } },
      comoComprar: { recoger: true, apartar: false },
      comoAtiende: { conCita: true, sinCita: false, aDomicilio: false },
      especialDia: {
        titulo: "Combo",
        precio: "350 CUP",
        moneda: "CUP",
        hasta: "2100-01-01",
      },
      catalogoTitulo: "Menú de la casa",
      menuCategorias: [{ nombre: "Cafés", orden: 1 }],
      existenciasModo: "exacta",
      catalogoActualizadoEn: 1700000000000,
      reviewsStats: { promedio: 4.5, total: 8 },
      resenaDestacada: {
        id: "r1",
        rating: 5,
        content: "Muy bueno",
        author: "Ana",
        createdAt: 1700000000000,
        respuesta: null,
      },
      phone: "+53 5 123 4567",
    }),
  );

  assert.equal(place.shortDescription, "Tostado propio");
  assert.equal(place.tipoNegocio, "cafeteria");
  assert.deepEqual(place.modulosActivos, ["local", "domicilio"]);
  assert.deepEqual(place.atributos, ["wifi", "terraza"]);
  assert.equal(place.colorMarca, "#0F7A41");
  assert.equal(place.portadaEncuadre, "arriba");
  assert.deepEqual(place.acciones?.fila, ["como_llegar", "whatsapp"]);
  assert.equal(place.horario?.semana.lun?.[0]?.abre, "08:00");
  assert.equal(place.cerradoMensaje, "Cerrado por inventario");
  assert.equal(place.entrega?.costo.modo, "gratis");
  assert.equal(place.comoComprar?.recoger, true);
  assert.equal(place.comoAtiende?.conCita, true);
  assert.equal(place.especialDia?.titulo, "Combo");
  assert.equal(place.catalogoTitulo, "Menú de la casa");
  assert.equal(place.menuCategorias?.[0]?.nombre, "Cafés");
  assert.equal(place.existenciasModo, "exacta");
  assert.equal(place.catalogoActualizadoEn, 1700000000000);
  assert.deepEqual(place.reviewsStats, { promedio: 4.5, total: 8 });
  assert.equal(place.resenaDestacada?.author, "Ana");
  assert.equal(place.phone, "+53 5 123 4567");
});

test("una ficha vacía no inventa fotos, descripción ni valoración", () => {
  const place = userPlaceToPlaceData(basePlace());

  assert.deepEqual(place.slides, []);
  assert.deepEqual(place.galeria, { local: [], trabajos: [] });
  assert.equal(place.description, "");
  assert.equal(place.shortDescription, undefined);
  assert.equal(place.reviewsStats, null);
  assert.equal(place.resenaDestacada, null);
  assert.equal(place.closedMessage, undefined);
});

test("la portada no se repite en la galería y los trabajos van aparte", () => {
  const place = userPlaceToPlaceData(
    basePlace({
      photos: [
        {
          url: "https://fotos/portada.jpg",
          alt: null,
          width: 1600,
          height: 900,
          isCover: true,
          seccion: "local",
        },
        {
          url: "https://fotos/salon.jpg",
          alt: "Salón",
          width: 1200,
          height: 900,
          isCover: false,
          seccion: "local",
        },
        {
          url: "https://fotos/trabajo.jpg",
          alt: null,
          width: 900,
          height: 1200,
          isCover: false,
          seccion: "trabajos",
        },
      ],
    }),
  );

  assert.equal(place.slides.length, 3);
  assert.deepEqual(
    place.galeria.local.map((foto) => foto.url),
    ["https://fotos/salon.jpg"],
  );
  assert.deepEqual(
    place.galeria.trabajos.map((foto) => foto.url),
    ["https://fotos/trabajo.jpg"],
  );
});

test("el menú oculto no llega a la ficha", () => {
  const place = userPlaceToPlaceData(
    basePlace({
      menu: [
        {
          id: "1",
          name: "Visible",
          description: "",
          price: "100",
          currency: "CUP",
        },
        {
          id: "2",
          name: "Oculto",
          description: "",
          price: "200",
          currency: "CUP",
          oculto: true,
        },
      ],
    }),
  );

  assert.deepEqual(
    place.menu.map((item) => item.name),
    ["Visible"],
  );
});
