import type { UserPlace } from "@/lib/places-store";

/**
 * Un negocio de mentira, para ver la app sin ensuciar la base.
 *
 * Existe solo en desarrollo (`NODE_ENV !== "production"`), y no llega a Postgres
 * nunca: se inyecta al leer, en `listPlaces` y `getPlaceById`. Se probó al
 * revés —una fila más en `places`, sembrada por un script— y es peor por dos
 * motivos: la rama de Neon es la misma que usa el resto del equipo, así que el
 * negocio fantasma acabaría saliendo en el mapa de producción, y borrarlo es
 * otro viaje a la base para deshacer algo que no hacía falta escribir.
 *
 * Aquí borrarlo es borrar este archivo.
 *
 * Lo que **no** cubre: la búsqueda por lenguaje natural, que ordena por el
 * vector `embedding` de `places` y este negocio no tiene fila donde guardarlo.
 */
export const DEV_PLACE_ID = "dev-cafe-la-ceiba";

/** El nombre de la categoría tiene que existir en `BUSINESS_CATEGORIES`. */
export function devPlaceEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function devPlace(): UserPlace | null {
  if (!devPlaceEnabled()) return null;

  return {
    id: DEV_PLACE_ID,
    name: "Café La Ceiba (local)",
    category: "Cafetería",
    icon: "Coffee",
    lat: 23.1367,
    lng: -82.3595,
    address: "Calle Ánimas 452, entre Manrique y San Nicolás",
    barrio: "Centro Habana",
    city: "La Habana",
    province: "La Habana",
    phone: "+53 7 862 4410",
    whatsapp: "+53551234567",
    instagram: "@cafélaceiba",
    description:
      "Cafetería de barrio con tostado propio y una terraza en el patio. " +
      "Ficha de prueba: solo la ve quien corre el proyecto en su máquina.",
    schedule: "Todo el día",
    vibe: ["Tranquilo", "Con música"],
    payments: ["Efectivo (CUP)", "Efectivo (MLC)", "Transferencia"],
    menu: [
      {
        name: "Café de la casa",
        description: "Tostado aquí, molido al momento.",
        price: "150",
        currency: "CUP",
        tag: "Popular",
      },
      {
        name: "Colada",
        description: "Para llevar en termo.",
        price: "400",
        currency: "CUP",
      },
      {
        name: "Sándwich de jamón",
        description: "Pan de la panadería de enfrente.",
        price: "2.50",
        currency: "MLC",
      },
    ],
    offer: {
      text: "Dos cafés por el precio de uno, de 3 a 5 de la tarde.",
      expiry: "31 de diciembre, 2026",
    },
    status: "active",
    isActive: true,
    reviewStatus: "approved",
    isBoosted: false,
    boostExpiresAt: "",
    rating: 4.9,
    priceLabel: "1–3 USD",
    aiTags: ["Café de especialidad", "Terraza", "Barrio"],
    photos: [],
    /* Fecha fija y no `Date.now()`: así el orden del catálogo no baila entre
       recargas y el diff de este archivo no cambia solo. */
    createdAt: 1767225600000,
    updatedAt: 1767225600000,
  };
}
