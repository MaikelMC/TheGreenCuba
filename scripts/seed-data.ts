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
    "id": "primos-twice",
    "name": "Primos Twice",
    "category": "Restaurante",
    "lat": 20.0213,
    "lng": -75.8235,
    "address": "Paseo de Enramadas",
    "barrio": "Enramadas",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Clásico del centro con carta cubana, pastas, pescado y carne. Tercio del paseo de Enramadas, mucho gentío local.",
    "schedule": "Todo el día",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Agradable",
      "Céntrico",
      "Todo el día"
    ],
    "rating": 4.7,
    "priceLabel": "300–1200 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 1
  },
  {
    "id": "bendita-farandula",
    "name": "Restaurante Bendita Farándula",
    "category": "Restaurante",
    "lat": 20.0225,
    "lng": -75.8271,
    "address": "Cerca de la Calle Heredia",
    "barrio": "Centro histórico",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Paladar del casco histórico, platos criollos con toque de horno de leña, cerca de la Calle Heredia.",
    "schedule": "De noche",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Cercano",
      "Casero",
      "Noche"
    ],
    "rating": 4.3,
    "priceLabel": "200–900 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 2
  },
  {
    "id": "la-cabana",
    "name": "Restaurante La Cabaña",
    "category": "Restaurante",
    "lat": 20.0178,
    "lng": -75.8302,
    "address": "",
    "barrio": "",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Famoso por mariscos, parrillada de pescado y pulpo. Terraza, parqueo y servicio atento.",
    "schedule": "De noche",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Fresco",
      "Familiar",
      "Noche"
    ],
    "rating": 4.9,
    "priceLabel": "400–1500 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 3
  },
  {
    "id": "alo-cubano",
    "name": "Alo Cubano",
    "category": "Restaurante",
    "lat": 20.012,
    "lng": -75.8468,
    "address": "",
    "barrio": "Reparto Sueño",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Restaurante interior acondicionado en el Reparto Sueño, buena carta y cócteles. Rincón tranquilo para una cena.",
    "schedule": "De noche",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Elegante",
      "Tranquilo",
      "Noche"
    ],
    "rating": 4.8,
    "priceLabel": "400–1800 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 4
  },
  {
    "id": "st-pauli",
    "name": "St. Pauli Restaurant-Bar",
    "category": "Restaurante",
    "lat": 20.0221,
    "lng": -75.8226,
    "address": "Enramadas (José A. Saco) 605, e/ Barnada y Plácido",
    "barrio": "Enramadas",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Bar-restaurante en plena Enramadas: buena comida y ambiente que va subiendo de tono a la noche.",
    "schedule": "De noche",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Animado",
      "Bohemio",
      "Noche"
    ],
    "rating": 4.3,
    "priceLabel": "300–1200 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 5
  },
  {
    "id": "terraza-padre-pico",
    "name": "Terraza Padre Pico",
    "category": "Restaurante",
    "lat": 20.0195,
    "lng": -75.8295,
    "address": "Zona de Padre Pico",
    "barrio": "Padre Pico",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Paladar de la zona de Padre Pico con cocina criolla y música en vivo; más de barrio que de turista.",
    "schedule": "De noche",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Auténtico",
      "Musical",
      "Noche"
    ],
    "rating": 4.5,
    "priceLabel": "200–900 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 6
  },
  {
    "id": "la-caribena",
    "name": "La Caribeña",
    "category": "Restaurante",
    "lat": 20.0183,
    "lng": -75.8298,
    "address": "Calle San Carlos",
    "barrio": "Centro histórico",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Cocina cubana e internacional en la calle San Carlos, opción económica y céntrica para comer a diario.",
    "schedule": "De día",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Casero",
      "Céntrico",
      "Día"
    ],
    "rating": 4.3,
    "priceLabel": "250–1000 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 7
  },
  {
    "id": "el-barracon",
    "name": "El Barracón",
    "category": "Restaurante",
    "lat": 20.0245,
    "lng": -75.8174,
    "address": "Av. Victoriano Garzón e/ 1ra y Aponte",
    "barrio": "",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Restaurante en la Av. Victoriano Garzón e/ 1ra y Aponte, terraza con vista y comida criolla.",
    "schedule": "De noche",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Animado",
      "Fresco",
      "Noche"
    ],
    "rating": 4.4,
    "priceLabel": "300–1200 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 8
  },
  {
    "id": "mercado-municipal",
    "name": "Mercado Municipal",
    "category": "Mercado",
    "lat": 20.021,
    "lng": -75.831,
    "address": "Aguilera y Padre Pico",
    "barrio": "Centro histórico",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Mercado municipal en Aguilera y Padre Pico: frutas, verduras y productos locales frescos.",
    "schedule": "De día",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Tradicional",
      "Céntrico",
      "Día"
    ],
    "rating": 4.2,
    "priceLabel": "CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 9
  },
  {
    "id": "mercado-artesanal-heredia",
    "name": "Mercado artesanal Calle Heredia",
    "category": "Mercado",
    "lat": 20.021,
    "lng": -75.828,
    "address": "Calle Heredia (desde Parque Céspedes)",
    "barrio": "Centro histórico",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Mercado artesanal sobre la Calle Heredia, desde Parque Céspedes: artesanías, recuerdos y souvenirs.",
    "schedule": "De día",
    "payments": [
      "CUP",
      "USD",
      "MLC"
    ],
    "currency": [
      "CUP",
      "USD",
      "MLC"
    ],
    "vibe": [
      "Tradicional",
      "Turístico",
      "Día"
    ],
    "rating": 4.3,
    "priceLabel": "CUP / USD",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 10
  },
  {
    "id": "restaurante-aurora",
    "name": "Restaurante Aurora",
    "category": "Restaurante",
    "lat": 20.02,
    "lng": -75.827,
    "address": "General Portuondo",
    "barrio": "Centro histórico",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Restaurante criollo en General Portuondo, comida casera santiaguera a buen precio.",
    "schedule": "De día",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Casero",
      "Tranquilo",
      "Día"
    ],
    "rating": 4.2,
    "priceLabel": "200–800 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 11
  },
  {
    "id": "zunzun",
    "name": "Zunzún",
    "category": "Restaurante",
    "lat": 20.0266,
    "lng": -75.8053,
    "address": "Manduley 159, Vista Alegre",
    "barrio": "Vista Alegre",
    "city": "Vista Alegre",
    "province": "Santiago de Cuba",
    "description": "Restaurante en Manduley 159, Vista Alegre: cocina cubana con toque moderno y buena carta de cócteles.",
    "schedule": "De noche",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Moderno",
      "Animado",
      "Noche"
    ],
    "rating": 4.5,
    "priceLabel": "300–1000 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 12
  },
  {
    "id": "salon-tropical",
    "name": "Salón Tropical",
    "category": "Restaurante",
    "lat": 20.0205,
    "lng": -75.8073,
    "address": "Fernández Marcané 310, Reparto Santa Bárbara",
    "barrio": "Reparto Santa Bárbara",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Restaurante en Fernández Marcané 310, Reparto Santa Bárbara: comida criolla y música en vivo los fines de semana.",
    "schedule": "De noche",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Musical",
      "Familiar",
      "Noche"
    ],
    "rating": 4.3,
    "priceLabel": "200–900 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 13
  },
  {
    "id": "casa-de-la-trova",
    "name": "Casa de la Trova 'Pepe Sánchez'",
    "category": "Bar",
    "lat": 20.021,
    "lng": -75.8287,
    "address": "Calle Heredia",
    "barrio": "Centro histórico",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Institución musical de la Calle Heredia: trova y son en vivo cada noche en la cuna de la canción santiaguera. Entrada con cubierto.",
    "schedule": "De noche",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Auténtico",
      "Musical",
      "Noche"
    ],
    "rating": 4.8,
    "priceLabel": "100–600 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 14
  },
  {
    "id": "club-led-sports",
    "name": "Club LED Sports",
    "category": "Bar",
    "lat": 20.0235,
    "lng": -75.8175,
    "address": "Av. Manduley, Vista Alegre",
    "barrio": "Vista Alegre",
    "city": "Vista Alegre",
    "province": "Santiago de Cuba",
    "description": "Bar lounge con miles de luces LED y pantallas en la Avenida Manduley de Vista Alegre. Copas, música y ambiente.",
    "schedule": "De noche",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Moderno",
      "Animado",
      "Noche"
    ],
    "rating": 4.7,
    "priceLabel": "200–900 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 15
  },
  {
    "id": "cerveceria-puerto-del-rey",
    "name": "Cervecería Puerto del Rey",
    "category": "Bar",
    "lat": 20.0209,
    "lng": -75.8351,
    "address": "Av. Jesús Menéndez, junto a la bahía",
    "barrio": "Puerto",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Cervecería junto a la Avenida Jesús Menéndez, cerca de la bahía. Cerveza fría y picadera junto al puerto.",
    "schedule": "De noche",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Relajado",
      "Fresco",
      "Noche"
    ],
    "rating": 4.1,
    "priceLabel": "150–700 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 16
  },
  {
    "id": "coppelia-santiago",
    "name": "Heladería Coppelia",
    "category": "Cafetería",
    "lat": 20.0193,
    "lng": -75.8245,
    "address": "",
    "barrio": "Centro",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "La 'Catedral de los helados' santiaguera: helado barato y de calidad en pleno centro, tradición del barrio.",
    "schedule": "De día",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Clásico",
      "Familiar",
      "Día"
    ],
    "rating": 4.4,
    "priceLabel": "50–300 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 17
  },
  {
    "id": "casa-la-micaela",
    "name": "Casa La Micaela",
    "category": "Cafetería",
    "lat": 20.0207,
    "lng": -75.824,
    "address": "Entre Enramadas y la calle Corona",
    "barrio": "Enramadas",
    "city": "Santiago de Cuba",
    "province": "Santiago de Cuba",
    "description": "Cafetería al paso entre Enramadas y la calle Corona: café cubano, para llevar y desayunos.",
    "schedule": "De día",
    "payments": [
      "CUP"
    ],
    "currency": [
      "CUP"
    ],
    "vibe": [
      "Sencillo",
      "Céntrico",
      "Día"
    ],
    "rating": 4.5,
    "priceLabel": "100–500 CUP",
    "aiTags": [],
    "menu": [],
    "offer": null,
    "status": "active",
    "isBoosted": false,
    "boostExpiresAt": "",
    "createdAt": 18
  },
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
