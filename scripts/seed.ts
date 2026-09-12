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
  { id: generateId(), name: "Naturaleza", slug: "naturaleza", icon: "tree-pine", sortOrder: 8 },
  { id: generateId(), name: "Deporte", slug: "deporte", icon: "dumbbell", sortOrder: 9 },
  { id: generateId(), name: "Hospedaje", slug: "hospedaje", icon: "bed", sortOrder: 10 },
  { id: generateId(), name: "Transporte", slug: "transporte", icon: "car", sortOrder: 11 },
];

/** Negocios reales de Santiago de Cuba (coordenadas del catálogo original). */
const SEED_PLACES = [
  {"name":"Primos Twice","categorySlug":"restaurante","description":"Clásico del centro con carta cubana, pastas, pescado y carne. Tercio del paseo de Enramadas, mucho gentío local.","lat":20.0213,"lng":-75.8235,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Enramadas","address":"Paseo de Enramadas","vibe":["Agradable","Céntrico","Todo el día"],"currencies":["CUP"]},
  {"name":"Restaurante Bendita Farándula","categorySlug":"restaurante","description":"Paladar del casco histórico, platos criollos con toque de horno de leña, cerca de la Calle Heredia.","lat":20.0225,"lng":-75.8271,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Centro histórico","address":"Cerca de la Calle Heredia","vibe":["Cercano","Casero","Noche"],"currencies":["CUP"]},
  {"name":"Restaurante La Cabaña","categorySlug":"restaurante","description":"Famoso por mariscos, parrillada de pescado y pulpo. Terraza, parqueo y servicio atento.","lat":20.0178,"lng":-75.8302,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"","address":"","vibe":["Fresco","Familiar","Noche"],"currencies":["CUP"]},
  {"name":"Alo Cubano","categorySlug":"restaurante","description":"Restaurante interior acondicionado en el Reparto Sueño, buena carta y cócteles. Rincón tranquilo para una cena.","lat":20.012,"lng":-75.8468,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Reparto Sueño","address":"","vibe":["Elegante","Tranquilo","Noche"],"currencies":["CUP"]},
  {"name":"St. Pauli Restaurant-Bar","categorySlug":"restaurante","description":"Bar-restaurante en plena Enramadas: buena comida y ambiente que va subiendo de tono a la noche.","lat":20.0221,"lng":-75.8226,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Enramadas","address":"Enramadas (José A. Saco) 605, e/ Barnada y Plácido","vibe":["Animado","Bohemio","Noche"],"currencies":["CUP"]},
  {"name":"Terraza Padre Pico","categorySlug":"restaurante","description":"Paladar de la zona de Padre Pico con cocina criolla y música en vivo; más de barrio que de turista.","lat":20.0195,"lng":-75.8295,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Padre Pico","address":"Zona de Padre Pico","vibe":["Auténtico","Musical","Noche"],"currencies":["CUP"]},
  {"name":"La Caribeña","categorySlug":"restaurante","description":"Cocina cubana e internacional en la calle San Carlos, opción económica y céntrica para comer a diario.","lat":20.0183,"lng":-75.8298,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Centro histórico","address":"Calle San Carlos","vibe":["Casero","Céntrico","Día"],"currencies":["CUP"]},
  {"name":"El Barracón","categorySlug":"restaurante","description":"Restaurante en la Av. Victoriano Garzón e/ 1ra y Aponte, terraza con vista y comida criolla.","lat":20.0245,"lng":-75.8174,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"","address":"Av. Victoriano Garzón e/ 1ra y Aponte","vibe":["Animado","Fresco","Noche"],"currencies":["CUP"]},
  {"name":"Mercado Municipal","categorySlug":"mercado","description":"Mercado municipal en Aguilera y Padre Pico: frutas, verduras y productos locales frescos.","lat":20.021,"lng":-75.831,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Centro histórico","address":"Aguilera y Padre Pico","vibe":["Tradicional","Céntrico","Día"],"currencies":["CUP"]},
  {"name":"Mercado artesanal Calle Heredia","categorySlug":"mercado","description":"Mercado artesanal sobre la Calle Heredia, desde Parque Céspedes: artesanías, recuerdos y souvenirs.","lat":20.021,"lng":-75.828,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Centro histórico","address":"Calle Heredia (desde Parque Céspedes)","vibe":["Tradicional","Turístico","Día"],"currencies":["CUP","USD","MLC"]},
  {"name":"Restaurante Aurora","categorySlug":"restaurante","description":"Restaurante criollo en General Portuondo, comida casera santiaguera a buen precio.","lat":20.02,"lng":-75.827,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Centro histórico","address":"General Portuondo","vibe":["Casero","Tranquilo","Día"],"currencies":["CUP"]},
  {"name":"Zunzún","categorySlug":"restaurante","description":"Restaurante en Manduley 159, Vista Alegre: cocina cubana con toque moderno y buena carta de cócteles.","lat":20.0266,"lng":-75.8053,"city":"Vista Alegre","province":"Santiago de Cuba","neighborhood":"Vista Alegre","address":"Manduley 159, Vista Alegre","vibe":["Moderno","Animado","Noche"],"currencies":["CUP"]},
  {"name":"Salón Tropical","categorySlug":"restaurante","description":"Restaurante en Fernández Marcané 310, Reparto Santa Bárbara: comida criolla y música en vivo los fines de semana.","lat":20.0205,"lng":-75.8073,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Reparto Santa Bárbara","address":"Fernández Marcané 310, Reparto Santa Bárbara","vibe":["Musical","Familiar","Noche"],"currencies":["CUP"]},
  {"name":"Casa de la Trova 'Pepe Sánchez'","categorySlug":"bar","description":"Institución musical de la Calle Heredia: trova y son en vivo cada noche en la cuna de la canción santiaguera. Entrada con cubierto.","lat":20.0210,"lng":-75.8287,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Centro histórico","address":"Calle Heredia","vibe":["Auténtico","Musical","Noche"],"currencies":["CUP"]},
  {"name":"Club LED Sports","categorySlug":"bar","description":"Bar lounge con miles de luces LED y pantallas en la Avenida Manduley de Vista Alegre. Copas, música y ambiente.","lat":20.0235,"lng":-75.8175,"city":"Vista Alegre","province":"Santiago de Cuba","neighborhood":"Vista Alegre","address":"Av. Manduley, Vista Alegre","vibe":["Moderno","Animado","Noche"],"currencies":["CUP"]},
  {"name":"Cervecería Puerto del Rey","categorySlug":"bar","description":"Cervecería junto a la Avenida Jesús Menéndez, cerca de la bahía. Cerveza fría y picadera junto al puerto.","lat":20.0209,"lng":-75.8351,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Puerto","address":"Av. Jesús Menéndez, junto a la bahía","vibe":["Relajado","Fresco","Noche"],"currencies":["CUP"]},
  {"name":"Heladería Coppelia","categorySlug":"cafeteria","description":"La 'Catedral de los helados' santiaguera: helado barato y de calidad en pleno centro, tradición del barrio.","lat":20.0193,"lng":-75.8245,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Centro","address":"","vibe":["Clásico","Familiar","Día"],"currencies":["CUP"]},
  {"name":"Casa La Micaela","categorySlug":"cafeteria","description":"Cafetería al paso entre Enramadas y la calle Corona: café cubano, para llevar y desayunos.","lat":20.0207,"lng":-75.824,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Enramadas","address":"Entre Enramadas y la calle Corona","vibe":["Sencillo","Céntrico","Día"],"currencies":["CUP"]},
  {"name":"Meliá Santiago de Cuba","categorySlug":"hospedaje","description":"El gran cinco estrellas de la ciudad, en la Av. de las Américas. Piscina, terrazas y vistas de la bahía.","lat":20.0263,"lng":-75.8108,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Reparto Sueño","address":"Av. de las Américas y Calle M, Reparto Sueño","vibe":["Elegante","Confort","Todo el día"],"currencies":["USD","MLC"]},
  {"name":"Hotel Casa Granda","categorySlug":"hospedaje","description":"Hotel histórico en el Parque Céspedes, con una de las mejores terrazas de la ciudad para ver el atardecer.","lat":20.0215,"lng":-75.8295,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Centro histórico","address":"Calle Heredia 201, esq. San Pedro (Parque Céspedes)","vibe":["Histórico","Céntrico","Todo el día"],"currencies":["USD","MLC"]},
  {"name":"Hotel Cubanacán Imperial","categorySlug":"hospedaje","description":"Alojamiento en Enramadas esq. Santo Tomás, bien ubicado para caminar todo el casco histórico.","lat":20.0212,"lng":-75.8249,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Centro histórico","address":"Enramadas esq. Santo Tomás","vibe":["Céntrico","Práctico","Todo el día"],"currencies":["USD","MLC"]},
  {"name":"Hotel Las Américas","categorySlug":"hospedaje","description":"Hotel en la Av. de las Américas esquina General Cebreco; opción cómoda lejos del trajín del centro.","lat":20.0138,"lng":-75.8298,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Vista Alegre","address":"Av. de las Américas esq. General Cebreco","vibe":["Tranquilo","Funcional","Todo el día"],"currencies":["USD","MLC"]},
  {"name":"Hotel Versalles","categorySlug":"hospedaje","description":"Hotel en las Alturas de Versalles con vista sobre la ciudad; salir a caminar y respirar la brisa.","lat":20.0261,"lng":-75.8158,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Alturas de Versalles","address":"Alturas de Versalles","vibe":["Sereno","Panorámico","Todo el día"],"currencies":["USD","MLC"]},
  {"name":"Hotel San Juan","categorySlug":"hospedaje","description":"En la carretera de Siboney, barrio de Vista Alegre, a medio camino entre la ciudad y las playas.","lat":20,"lng":-75.816,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Vista Alegre","address":"Carretera de Siboney, Vista Alegre","vibe":["Verde","Tranquilo","Todo el día"],"currencies":["USD","MLC"]},
  {"name":"Hotel E San Basilio","categorySlug":"hospedaje","description":"Hotelito boutique en plena calle San Basilio, con patio colonial y trato de casa; a un paso del centro.","lat":20.0188,"lng":-75.8302,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Centro histórico","address":"Calle San Basilio","vibe":["Acogedor","Histórico","Todo el día"],"currencies":["USD","MLC"]},
  {"name":"Castillo del Morro San Pedro de la Roca","categorySlug":"cultura","description":"Fortaleza del siglo XVII, patrimonio de la humanidad, con vistas espectaculares sobre la bahía.","lat":19.9695,"lng":-75.8661,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Bahía","address":"","vibe":["Histórico","Panorámico","Día"],"currencies":["CUP"]},
  {"name":"Cementerio Santa Ifigenia","categorySlug":"cultura","description":"Cementerio-monumento nacional: tumbas de José Martí y Fidel Castro, con cambio de guardia cada media hora.","lat":20.0275,"lng":-75.8317,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Centro","address":"","vibe":["Serio","Histórico","Día"],"currencies":["CUP"]},
  {"name":"Casa de Diego Velázquez","categorySlug":"cultura","description":"Una de las casas más antiguas de América, museo de ambiente histórico cubano frente a la Plaza de Marte.","lat":20.0197,"lng":-75.8259,"city":"Santiago de Cuba","province":"Santiago de Cuba","neighborhood":"Centro histórico","address":"Frente a la Plaza de Marte","vibe":["Educativo","Histórico","Día"],"currencies":["CUP"]},
  {"name":"Monumento Natural Gran Piedra","categorySlug":"naturaleza","description":"Impuesta roca a más de mil metros sobre el mar: cafetales franceses, neblina y vista de la costa sur.","lat":20.0107,"lng":-75.6287,"city":"Gran Piedra","province":"Santiago de Cuba","neighborhood":"Gran Piedra","address":"","vibe":["Aventura","Aire libre","Día"],"currencies":["CUP"]},
  {"name":"Playa Siboney","categorySlug":"playa","description":"Arenas finas y aguas claras a la salida de la ciudad; la playa del fin de semana de todo Santiago.","lat":19.966,"lng":-75.712,"city":"Siboney","province":"Santiago de Cuba","neighborhood":"Siboney","address":"","vibe":["Fresco","Familiar","Día"],"currencies":["CUP"]},
  {"name":"Playa Baconao","categorySlug":"playa","description":"Dentro del Parque Baconao (Reserva de la Biosfera): playa ancha, laguna y la costa del oriente cubano.","lat":19.87,"lng":-75.53,"city":"Baconao","province":"Santiago de Cuba","neighborhood":"Baconao","address":"","vibe":["Natural","Espacioso","Día"],"currencies":["CUP"]}
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
