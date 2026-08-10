export type PlaceCategory =
  | "restaurante"
  | "bar"
  | "café"
  | "naturaleza"
  | "cultura"
  | "playa";

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  city: string;
  province: string;
  subcategory: string;
  lat: number;
  lng: number;
  priceLabel: string;
  description: string;
  tags: string[];
  rating: number;
  vibe: string[];
}

export const CATEGORY_META: Record<PlaceCategory, { label: string; emoji: string }> = {
  restaurante: { label: "Restaurante", emoji: "🍽️" },
  bar: { label: "Bar", emoji: "🍹" },
  café: { label: "Café", emoji: "☕" },
  naturaleza: { label: "Naturaleza", emoji: "🌿" },
  cultura: { label: "Cultura", emoji: "🎨" },
  playa: { label: "Playa", emoji: "🏖️" }
};

// 14 lugares reales de Cuba (coordenadas aproximadas)
export const PLACES: Place[] = [
  {
    id: "la-concha-habana",
    name: "La Concha Habana",
    category: "restaurante",
    city: "La Habana",
    province: "La Habana",
    subcategory: "Cocina cubana moderna",
    lat: 23.1394,
    lng: -82.3833,
    priceLabel: "$15–30 USD",
    description:
      "Cocina cubana contemporánea con vista al Malecón. Menú de temporada y coctelería de autor.",
    tags: ["cenar", "romántico", "malecón", "vista al mar"],
    rating: 4.8,
    vibe: ["Acogedor", "Elegante", "Noche"]
  },
  {
    id: "el-fogón-viñales",
    name: "El Fogón de Viñales",
    category: "restaurante",
    city: "Viñales",
    province: "Pinar del Río",
    subcategory: "Casa de comidas",
    lat: 22.6144,
    lng: -83.7111,
    priceLabel: "$4–9 USD",
    description:
      "Auténtica comida campesina entre mogotes. Ropa vieja, tostones y café de palo con patio verde.",
    tags: ["comer", "local", "montaña", "tradicional"],
    rating: 4.7,
    vibe: ["Familiar", "Tradicional", "Día"]
  },
  {
    id: "café-viavana",
    name: "Café Viavana",
    category: "café",
    city: "La Habana",
    province: "La Habana",
    subcategory: "Café de especialidad",
    lat: 23.1136,
    lng: -82.3922,
    priceLabel: "$2–5 USD",
    description:
      "Café de especialidad cubano con tueste propio, jugos naturales y brunch el fin de semana.",
    tags: ["café", "desayuno", "trabajar", "brunch"],
    rating: 4.6,
    vibe: ["Tranquilo", "Moderno", "Día"]
  },
  {
    id: "bar-la-vereda",
    name: "Bar La Vereda",
    category: "bar",
    city: "La Habana",
    province: "La Habana",
    subcategory: "Coctelería y rum",
    lat: 23.1414,
    lng: -82.3770,
    priceLabel: "$6–12 USD",
    description:
      "Rones añejos, mojitos con hierbabuena del patio y música en vivo hasta tarde.",
    tags: ["copas", "música en vivo", "noche", "rom" ],
    rating: 4.5,
    vibe: ["Animado", "Lindero", "Noche"]
  },
  {
    id: "mirador-valle",
    name: "Mirador del Valle",
    category: "bar",
    city: "Viñales",
    province: "Pinar del Río",
    subcategory: "Café y tarde libre",
    lat: 22.6295,
    lng: -83.7094,
    priceLabel: "$3–7 USD",
    description:
      "Cartel libre y frescos bajo la sombra verde exactamente sobre el valle.",
    tags: ["afternoon", "vistas", "libertad", "café"],
    rating: 4.6,
    vibe: ["Relajado", "Aire libre", "Día"]
  },
  {
    id: "sendero-los-mogotes",
    name: "Sendero Los Mogotes",
    category: "naturaleza",
    city: "Viñales",
    province: "Pinar del Río",
    subcategory: "Senderismo guiado",
    lat: 22.6313,
    lng: -83.7100,
    priceLabel: "Gratis–$10 USD",
    description:
      "Trekking guiado entre los mogotes calcáreos con paradas en cuevas y miradores.",
    tags: ["naturaleza", "senderismo", "vista", "foto"],
    rating: 4.9,
    vibe: ["Aventura", "Aire libre", "Día"]
  },
  {
    id: "cueva-indio",
    name: "Cuevas del Indio",
    category: "cultura",
    city: "Viñales",
    province: "Pinar del Río",
    subcategory: "Sitio histórico",
    lat: 22.6136,
    lng: -83.7215,
    priceLabel: "$5 USD",
    description:
      "Recorrido en lancha por las grutas con pinturas rupestres de los primeros habitantes.",
    tags: ["historia", "naturaleza", "familia", "cultura"],
    rating: 4.4,
    vibe: ["Educativo", "Familiar", "Día"]
  },
  {
    id: "malecon-sunset",
    name: "Malecón al atardecer",
    category: "cultura",
    city: "La Habana",
    province: "La Habana",
    subcategory: "Paseo urbano",
    lat: 23.1400,
    lng: -82.3810,
    priceLabel: "Gratis",
    description:
      "El paseo marítimo más famoso de Cuba. Sol, ventoleras y rumba espontánea al caer la tarde.",
    tags: ["paseo", "atardecer", "malecón", "rumba"],
    rating: 4.8,
    vibe: ["Romántico", "Auténtico", "Tarde"]
  },
  {
    id: "vieja-mercado",
    name: "El Viejo Mercado",
    category: "restaurante",
    city: "La Habana",
    province: "La Habana",
    subcategory: "Gastro-bar urbano",
    lat: 23.1130,
    lng: -82.3560,
    priceLabel: "$10–18 USD",
    description:
      "Guest friendly gastro-bar bajo techos altos coloniales, picoteo para compartir y DJ.",
    tags: ["comer", "copas", "colorido", "fusión"],
    rating: 4.6,
    vibe: ["Animado", "Joven", "Noche"]
  },
  {
    id: "playa-jibacoa",
    name: "Playa Jibacoa",
    category: "playa",
    city: "Santa Cruz del Norte",
    province: "Mayabeque",
    subcategory: "Playa turquesa",
    lat: 23.1186,
    lng: -82.0076,
    priceLabel: "Gratis",
    description:
      "Aguas cristalinas y arena fina a 40 minutos de La Habana. Perfecta para un día de playa.",
    tags: ["playa", "natación", "sol", "familia"],
    rating: 4.7,
    vibe: ["Fresco", "Familiar", "Día"]
  },
  {
    id: "terrazas-cojimar",
    name: "Terrazas de Cojímar",
    category: "restaurante",
    city: "Cojímar",
    province: "La Habana",
    subcategory: "Mariscos y vista",
    lat: 23.1586,
    lng: -82.3000,
    priceLabel: "$8–15 USD",
    description:
      "Pescado fresco del día con vista al fortín, frente al mar del poblado de Hemingway.",
    tags: ["pescado", "mar", "vista", "cenar"],
    rating: 4.5,
    vibe: ["Marinero", "Familiar", "Día"]
  },
  {
    id: "cementerio-cristóbal",
    name: "Cementerio de Colón",
    category: "cultura",
    city: "La Habana",
    province: "La Habana",
    subcategory: "Arquitectura y memoria",
    lat: 23.1278,
    lng: -82.3549,
    priceLabel: "Gratis",
    description:
      "Necrópolis monumental con 800 mausoleos, uno de los cementerios más bellos de América.",
    tags: ["historia", "arquitectura", "cultura", "foto"],
    rating: 4.6,
    vibe: ["Sereno", "Histórico", "Día"]
  },
  {
    id: "casa-verde-varadero",
    name: "Casa Verde Varadero",
    category: "café",
    city: "Varadero",
    province: "Matanzas",
    subcategory: "Café colonia",
    lat: 23.1352,
    lng: -81.2837,
    priceLabel: "$3–6 USD",
    description:
      "Café de versalles y postres caseros pegadito al bulevar, sombra verde y brisa de playa.",
    tags: ["café", "desayuno", "playa", "dulce"],
    rating: 4.5,
    vibe: ["Acogedor", "Ligero", "Día"]
  },
  {
    id: "limonar-valle",
    name: "Limonar del Valle",
    category: "naturaleza",
    city: "Matanzas",
    province: "Matanzas",
    subcategory: "Valle y picnic",
    lat: 22.9753,
    lng: -81.5194,
    priceLabel: "$3 USD",
    description:
      "Huertas verdes, letreros campestres y una palmera de copa para un picnic con vista.",
    tags: ["paseo", "picnic", "valle", "verde"],
    rating: 4.3,
    vibe: ["Tranquilo", "Aire libre", "Día"]
  }
];

export function placesByCity(city: string): Place[] {
  return PLACES.filter((p) => p.city === city);
}

export function findPlace(path: string): Place | undefined {
  return PLACES.find((p) => p.id === path);
}

// Resumen del mapa para el hero contador
export const SITE_STATS = {
  places: PLACES.length,
  cities: new Set(PLACES.map((p) => p.province)).size
};