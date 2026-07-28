export const CITIES = [
  { value: "la-habana", label: "La Habana" },
  { value: "santiago-de-cuba", label: "Santiago de Cuba" },
  { value: "varadero", label: "Varadero" },
  { value: "trinidad", label: "Trinidad" },
  { value: "cienfuegos", label: "Cienfuegos" },
  { value: "holguin", label: "Holguín" },
  { value: "camaguey", label: "Camagüey" },
  { value: "matanzas", label: "Matanzas" },
  { value: "pinardelrio", label: "Pinar del Río" },
  { value: "other", label: "Otra" },
] as const;

export const CATEGORIES = [
  { value: "cafeteria", label: "Cafetería", icon: "coffee" },
  { value: "restaurante", label: "Restaurante", icon: "utensils" },
  { value: "bar", label: "Bar", icon: "wine" },
  { value: "discoteca", label: "Discoteca", icon: "music" },
  { value: "mercado", label: "Mercado", icon: "shopping-bag" },
  { value: "playa", label: "Playa", icon: "umbrella" },
  { value: "cultura", label: "Cultura", icon: "landmark" },
  { value: "deporte", label: "Deporte", icon: "dumbbell" },
  { value: "hospedaje", label: "Hospedaje", icon: "bed" },
  { value: "transporte", label: "Transporte", icon: "car" },
] as const;

export const CURRENCIES = [
  { value: "MLC", label: "MLC", badge: "Moneda Libremente Convertible" },
  { value: "CUP", label: "CUP", badge: "Peso Cubano" },
  { value: "USD", label: "USD", badge: "Dólar Americano" },
  { value: "EUR", label: "EUR", badge: "Euro" },
] as const;

export const MOODS = [
  { value: "tranquilo", label: "Tranquilo" },
  { value: "fiesta", label: "Fiesta" },
  { value: "romantico", label: "Romántico" },
  { value: "familiar", label: "Familiar" },
  { value: "cultural", label: "Cultural" },
  { value: "aventura", label: "Aventura" },
  { value: "trabajo", label: "Trabajo" },
  { value: "salud", label: "Salud" },
] as const;

export const MAP_CONFIG = {
  defaultCenter: [23.1136, -82.3666] as [number, number], // Havana
  defaultZoom: 13,
  minZoom: 8,
  maxZoom: 18,
  tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
} as const;

export const DAYS_OF_WEEK = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const FILTERS = [
  { value: "nearby", label: "Cercanos" },
  { value: "mlc", label: "Aceptan MLC" },
  { value: "open_now", label: "Abiertos ahora" },
  { value: "quiet", label: "Tranquilo" },
  { value: "music", label: "Con música" },
] as const;
