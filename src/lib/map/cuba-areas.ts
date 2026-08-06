export interface CubaArea {
  id: string;
  name: string;
  province: string;
  lat: number;
  lng: number;
}

/**
 * Ciudades y zonas de referencia en toda Cuba (todas las provincias).
 * Se usan para centrar el mapa rápido al ubicar un negocio, sin escribir
 * coordenadas. La Verde cubre todo el país, no solo La Habana.
 */
export const CUBA_AREAS: CubaArea[] = [
  { id: "pinar-del-rio", name: "Pinar del Río", province: "Pinar del Río", lat: 22.412, lng: -83.696 },
  { id: "vinales", name: "Viñales", province: "Pinar del Río", lat: 22.618, lng: -83.708 },
  { id: "artemisa", name: "Artemisa", province: "Artemisa", lat: 22.813, lng: -82.762 },
  { id: "mariel", name: "Mariel", province: "Artemisa", lat: 22.989, lng: -82.755 },
  { id: "la-habana", name: "La Habana", province: "La Habana", lat: 23.137, lng: -82.359 },
  { id: "guanabo", name: "Guanabo", province: "La Habana", lat: 23.158, lng: -82.117 },
  { id: "guines", name: "Güines", province: "Mayabeque", lat: 22.838, lng: -82.027 },
  { id: "batabano", name: "Batabanó", province: "Mayabeque", lat: 22.716, lng: -82.289 },
  { id: "matanzas", name: "Matanzas", province: "Matanzas", lat: 23.041, lng: -81.576 },
  { id: "varadero", name: "Varadero", province: "Matanzas", lat: 23.15, lng: -81.25 },
  { id: "cardenas", name: "Cárdenas", province: "Matanzas", lat: 23.038, lng: -81.207 },
  { id: "cienfuegos", name: "Cienfuegos", province: "Cienfuegos", lat: 22.146, lng: -80.436 },
  { id: "trinidad", name: "Trinidad", province: "Sancti Spíritus", lat: 21.802, lng: -79.985 },
  { id: "sancti-spiritus", name: "Sancti Spíritus", province: "Sancti Spíritus", lat: 21.93, lng: -79.443 },
  { id: "santa-clara", name: "Santa Clara", province: "Villa Clara", lat: 22.407, lng: -79.965 },
  { id: "remedios", name: "Remedios", province: "Villa Clara", lat: 22.493, lng: -79.545 },
  { id: "ciego-de-avila", name: "Ciego de Ávila", province: "Ciego de Ávila", lat: 21.849, lng: -78.761 },
  { id: "moron", name: "Morón", province: "Ciego de Ávila", lat: 22.109, lng: -78.627 },
  { id: "camaguey", name: "Camagüey", province: "Camagüey", lat: 21.379, lng: -77.916 },
  { id: "nuevitas", name: "Nuevitas", province: "Camagüey", lat: 21.542, lng: -77.265 },
  { id: "las-tunas", name: "Las Tunas", province: "Las Tunas", lat: 20.967, lng: -76.95 },
  { id: "holguin", name: "Holguín", province: "Holguín", lat: 20.888, lng: -76.257 },
  { id: "guardalavaca", name: "Guardalavaca", province: "Holguín", lat: 21.116, lng: -75.826 },
  { id: "bayamo", name: "Bayamo", province: "Granma", lat: 20.379, lng: -76.643 },
  { id: "manzanillo", name: "Manzanillo", province: "Granma", lat: 20.34, lng: -77.112 },
  { id: "santiago-de-cuba", name: "Santiago de Cuba", province: "Santiago de Cuba", lat: 20.014, lng: -75.826 },
  { id: "guantanamo", name: "Guantánamo", province: "Guantánamo", lat: 20.145, lng: -75.209 },
  { id: "baracoa", name: "Baracoa", province: "Guantánamo", lat: 20.347, lng: -74.497 },
  { id: "isla-de-la-juventud", name: "Nueva Gerona", province: "Isla de la Juventud", lat: 21.885, lng: -82.802 },
];
