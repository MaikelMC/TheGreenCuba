import { db, schema } from "@/lib/db";
import { slugify, generateId } from "@/lib/utils";

const CATEGORIES = [
  { id: generateId(), name: "Cafetería", slug: "cafeteria", icon: "coffee", sortOrder: 1 },
  { id: generateId(), name: "Restaurante", slug: "restaurante", icon: "utensils", sortOrder: 2 },
  { id: generateId(), name: "Bar", slug: "bar", icon: "wine", sortOrder: 3 },
  { id: generateId(), name: "Discoteca", slug: "discoteca", icon: "music", sortOrder: 4 },
  { id: generateId(), name: "Mercado", slug: "mercado", icon: "shopping-bag", sortOrder: 5 },
  { id: generateId(), name: "Playa", slug: "playa", icon: "umbrella", sortOrder: 6 },
  { id: generateId(), name: "Cultura", slug: "cultura", icon: "landmark", sortOrder: 7 },
  { id: generateId(), name: "Deporte", slug: "deporte", icon: "dumbbell", sortOrder: 8 },
  { id: generateId(), name: "Hospedaje", slug: "hospedaje", icon: "bed", sortOrder: 9 },
  { id: generateId(), name: "Transporte", slug: "transporte", icon: "car", sortOrder: 10 },
];

const SEED_PLACES = [
  {
    name: "El Cocinero",
    categorySlug: "restaurante",
    description: "Restaurante contemporáneo en un antiguo fogonero de gas. Terraza con vista al Malecón.",
    lat: 23.1412,
    lng: -82.3761,
    city: "La Habana",
    province: "La Habana",
    neighborhood: "Vedado",
    address: "Calle 26 esq. Calle 11, Vedado",
    phone: "+53 7 836 6050",
    vibe: ["romantico", "tranquilo", "cultural"],
    currencies: ["MLC", "USD"],
  },
  {
    name: "Café Escorial",
    categorySlug: "cafeteria",
    description: "Cafetería tradicional habanera con más de 100 años de historia.",
    lat: 23.1381,
    lng: -82.3583,
    city: "La Habana",
    province: "La Habana",
    neighborhood: "Habana Vieja",
    address: "Calle Mercaderes No. 207, Habana Vieja",
    vibe: ["tranquilo", "cultural"],
    currencies: ["CUP", "MLC"],
  },
  {
    name: "Fábrica de Arte Cubano",
    categorySlug: "cultura",
    description: "Centro cultural multidisciplinario con galerías, música en vivo y restaurante.",
    lat: 23.1442,
    lng: -82.3795,
    city: "La Habana",
    province: "La Habana",
    neighborhood: "Vedado",
    address: "Calle 26 esq. Calle 11, Vedado",
    vibe: ["fiesta", "cultural", "musica"],
    currencies: ["MLC", "CUP", "USD"],
  },
  {
    name: "La Guarida",
    categorySlug: "restaurante",
    description: "Restaurante paladar icónico en un edificio histórico, escenario de la película Fresa y Chocolate.",
    lat: 23.1309,
    lng: -82.3855,
    city: "La Habana",
    province: "La Habana",
    neighborhood: "Centro Habana",
    address: "Calle Concordia No. 418, Centro Habana",
    vibe: ["romantico", "cultural"],
    currencies: ["MLC", "USD"],
  },
  {
    name: "Café de la Esquina",
    categorySlug: "cafeteria",
    description: "Café de especialidad con granos cubanos y métodos de filtrado.",
    lat: 23.1405,
    lng: -82.3742,
    city: "La Habana",
    province: "La Habana",
    neighborhood: "Vedado",
    address: "Calle 23 esq. Calle O, Vedado",
    vibe: ["tranquilo", "trabajo"],
    currencies: ["MLC"],
  },
];

async function seed() {
  console.log("🌱 Seeding database...");

  console.log("📁 Inserting categories...");
  for (const cat of CATEGORIES) {
    await db.insert(schema.categories).values(cat).onConflictDoNothing();
  }

  console.log("📍 Inserting places...");
  for (const place of SEED_PLACES) {
    const category = CATEGORIES.find((c) => c.slug === place.categorySlug);
    await db
      .insert(schema.places)
      .values({
        id: generateId(),
        name: place.name,
        slug: slugify(place.name),
        description: place.description,
        categoryId: category!.id,
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        city: place.city,
        province: place.province,
        neighborhood: place.neighborhood,
        phone: place.phone,
        vibe: place.vibe,
        currencies: place.currencies,
        isActive: true,
        status: "active",
      })
      .onConflictDoNothing();
  }

  console.log("✅ Seed complete!");
}

seed()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .then(() => process.exit(0));
