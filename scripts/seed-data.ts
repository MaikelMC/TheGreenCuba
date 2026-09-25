/**
 * Datos del catalogo inicial de La Verde.
 *
 * Unica fuente de verdad de la semilla: la usa scripts/seed.ts para poblar
 * Neon. El cliente ya no siembra nada; lee de la API, que lee de la base.
 *
 * Fusionado a partir del catalogo del cliente (valoracion, etiqueta de precio,
 * horario) y del que se uso para la primera siembra (ambiente y monedas), que
 * describian los mismos 31 negocios.
 */
export interface SeedPlace {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  barrio: string;
  city: string;
  province: string;
  description: string;
  schedule: string;
  /** Formas de pago aceptadas. */
  payments: string[];
  /** Monedas en que cobra. */
  currency: string[];
  /** Ambiente, para el texto que se embebe. */
  vibe: string[];
  rating: number | null;
  priceLabel: string;
  aiTags: string[];
  menu: { name: string; description: string; price: string; currency: string }[];
  offer: { text: string; expiry: string } | null;
  status: "active" | "closed" | "temporary_closed";
  isBoosted: boolean;
  boostExpiresAt: string;
  createdAt: number;
}

export const SEED_PLACES: SeedPlace[] = [
  {
    "id": "melia-santiago",
    "name": "Meliá Santiago de Cuba",
    "category": "Hospedaje",
    "lat": 20.0263,
    "lng": -75.8108,
    "address": "Av. de las Américas y Calle M, Reparto Sueño",
    "barrio": "Reparto Sueño",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "El gran cinco estrellas de la ciudad, en la Av. de las Américas. Piscina, terrazas y vistas de la bahía.",
    "schedule": "Todo el día",
    "payments": [
      "USD",
      "MLC"
    ],
    "currency": [
      "USD",
      "MLC"
    ],
    "vibe": [
      "Elegante",
      "Confort",
      "Todo el día"
    ],
    "rating": 4.6,
    "priceLabel": "$95–180 USD",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 19
  },
  {
    "id": "hotel-casa-granda",
    "name": "Hotel Casa Granda",
    "category": "Hospedaje",
    "lat": 20.0215,
    "lng": -75.8295,
    "address": "Calle Heredia 201, esq. San Pedro (Parque Céspedes)",
    "barrio": "Centro histórico",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Hotel histórico en el Parque Céspedes, con una de las mejores terrazas de la ciudad para ver el atardecer.",
    "schedule": "Todo el día",
    "payments": [
      "USD",
      "MLC"
    ],
    "currency": [
      "USD",
      "MLC"
    ],
    "vibe": [
      "Histórico",
      "Céntrico",
      "Todo el día"
    ],
    "rating": 4.4,
    "priceLabel": "$70–120 USD",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 20
  },
  {
    "id": "hotel-cubanacan-imperial",
    "name": "Hotel Cubanacán Imperial",
    "category": "Hospedaje",
    "lat": 20.0212,
    "lng": -75.8249,
    "address": "Enramadas esq. Santo Tomás",
    "barrio": "Centro histórico",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Alojamiento en Enramadas esq. Santo Tomás, bien ubicado para caminar todo el casco histórico.",
    "schedule": "Todo el día",
    "payments": [
      "USD",
      "MLC"
    ],
    "currency": [
      "USD",
      "MLC"
    ],
    "vibe": [
      "Céntrico",
      "Práctico",
      "Todo el día"
    ],
    "rating": 4.5,
    "priceLabel": "$70–120 USD",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 21
  },
  {
    "id": "hotel-las-americas",
    "name": "Hotel Las Américas",
    "category": "Hospedaje",
    "lat": 20.0138,
    "lng": -75.8298,
    "address": "Av. de las Américas esq. General Cebreco",
    "barrio": "Vista Alegre",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Hotel en la Av. de las Américas esquina General Cebreco; opción cómoda lejos del trajín del centro.",
    "schedule": "Todo el día",
    "payments": [
      "USD",
      "MLC"
    ],
    "currency": [
      "USD",
      "MLC"
    ],
    "vibe": [
      "Tranquilo",
      "Funcional",
      "Todo el día"
    ],
    "rating": 4,
    "priceLabel": "$50–90 USD",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 22
  },
  {
    "id": "hotel-versalles",
    "name": "Hotel Versalles",
    "category": "Hospedaje",
    "lat": 20.0261,
    "lng": -75.8158,
    "address": "Alturas de Versalles",
    "barrio": "Alturas de Versalles",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Hotel en las Alturas de Versalles con vista sobre la ciudad; salir a caminar y respirar la brisa.",
    "schedule": "Todo el día",
    "payments": [
      "USD",
      "MLC"
    ],
    "currency": [
      "USD",
      "MLC"
    ],
    "vibe": [
      "Sereno",
      "Panorámico",
      "Todo el día"
    ],
    "rating": 4.2,
    "priceLabel": "Desde $55 USD",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 23
  },
  {
    "id": "hotel-san-juan",
    "name": "Hotel San Juan",
    "category": "Hospedaje",
    "lat": 20,
    "lng": -75.816,
    "address": "Carretera de Siboney, Vista Alegre",
    "barrio": "Vista Alegre",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "En la carretera de Siboney, barrio de Vista Alegre, a medio camino entre la ciudad y las playas.",
    "schedule": "Todo el día",
    "payments": [
      "USD",
      "MLC"
    ],
    "currency": [
      "USD",
      "MLC"
    ],
    "vibe": [
      "Verde",
      "Tranquilo",
      "Todo el día"
    ],
    "rating": 4.1,
    "priceLabel": "$50–90 USD",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 24
  },
  {
    "id": "hotel-e-san-basilio",
    "name": "Hotel E San Basilio",
    "category": "Hospedaje",
    "lat": 20.0188,
    "lng": -75.8302,
    "address": "Calle San Basilio",
    "barrio": "Centro histórico",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Hotelito boutique en plena calle San Basilio, con patio colonial y trato de casa; a un paso del centro.",
    "schedule": "Todo el día",
    "payments": [
      "USD",
      "MLC"
    ],
    "currency": [
      "USD",
      "MLC"
    ],
    "vibe": [
      "Acogedor",
      "Histórico",
      "Todo el día"
    ],
    "rating": 4.5,
    "priceLabel": "$45–80 USD",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 25
  },
  {
    "id": "castillo-del-morro",
    "name": "Castillo del Morro San Pedro de la Roca",
    "category": "Cultura",
    "lat": 19.9695,
    "lng": -75.8661,
    "address": "",
    "barrio": "Bahía",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Fortaleza del siglo XVII, patrimonio de la humanidad, con vistas espectaculares sobre la bahía.",
    "schedule": "De día",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Histórico",
      "Panorámico",
      "Día"
    ],
    "rating": 4.7,
    "priceLabel": "100 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 26
  },
  {
    "id": "cementerio-santa-ifigenia",
    "name": "Cementerio Santa Ifigenia",
    "category": "Cultura",
    "lat": 20.0275,
    "lng": -75.8317,
    "address": "",
    "barrio": "Centro",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Cementerio-monumento nacional: tumbas de José Martí y Fidel Castro, con cambio de guardia cada media hora.",
    "schedule": "De día",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Serio",
      "Histórico",
      "Día"
    ],
    "rating": 4.6,
    "priceLabel": "200 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 27
  },
  {
    "id": "casa-de-diego-velazquez",
    "name": "Casa de Diego Velázquez",
    "category": "Cultura",
    "lat": 20.0197,
    "lng": -75.8259,
    "address": "Frente a la Plaza de Marte",
    "barrio": "Centro histórico",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Una de las casas más antiguas de América, museo de ambiente histórico cubano frente a la Plaza de Marte.",
    "schedule": "De día",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Educativo",
      "Histórico",
      "Día"
    ],
    "rating": 4.4,
    "priceLabel": "100 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 28
  },
  {
    "id": "monumento-gran-piedra",
    "name": "Monumento Natural Gran Piedra",
    "category": "Naturaleza",
    "lat": 20.0107,
    "lng": -75.6287,
    "address": "",
    "barrio": "Gran Piedra",
    "city": "Gran Piedra",
    "province": "Santiago de Cuba",
    "description": "Impuesta roca a más de mil metros sobre el mar: cafetales franceses, neblina y vista de la costa sur.",
    "schedule": "De día",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Aventura",
      "Aire libre",
      "Día"
    ],
    "rating": 4.8,
    "priceLabel": "50–150 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 29
  },
  {
    "id": "playa-siboney",
    "name": "Playa Siboney",
    "category": "Playa",
    "lat": 19.966,
    "lng": -75.712,
    "address": "",
    "barrio": "Siboney",
    "city": "Siboney",
    "province": "Santiago de Cuba",
    "description": "Arenas finas y aguas claras a la salida de la ciudad; la playa del fin de semana de todo Santiago.",
    "schedule": "De día",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Fresco",
      "Familiar",
      "Día"
    ],
    "rating": 4.6,
    "priceLabel": "Gratis",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 30
  },
  {
    "id": "playa-baconao",
    "name": "Playa Baconao",
    "category": "Playa",
    "lat": 19.87,
    "lng": -75.53,
    "address": "",
    "barrio": "Baconao",
    "city": "Baconao",
    "province": "Santiago de Cuba",
    "description": "Dentro del Parque Baconao (Reserva de la Biosfera): playa ancha, laguna y la costa del oriente cubano.",
    "schedule": "De día",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Natural",
      "Espacioso",
      "Día"
    ],
    "rating": 4.4,
    "priceLabel": "Gratis",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 31
  }
];
