"use client";

import { useParams, useRouter } from "next/navigation";
import { PlaceDetail, type PlaceData } from "@/components/place/place-detail";

const MOCK_PLACE: PlaceData = {
  id: "3",
  name: "La Guarida",
  category: "Restaurante",
  rating: 4.7,
  distance: "1.2 km",
  barrio: "Vedado",
  schedule: "12PM – 12AM",
  payments: ["MLC", "CUP", "USD"],
  description: "Restaurante cubano contemporáneo en Vedado",
  longDescription:
    "La Guarida es un restaurante cubano contemporáneo ubicado en el corazón de Vedado, La Habana. Ocupa un edificio art déco de los años 40 que mantiene su fachada original con columnas y balcones de hierro forjado. El interior combina la arquitectura colonial con un diseño moderno y cálido — madera oscura, iluminación tenue y arte cubano en las paredes. Fundado en 2018 por un grupo de amigos chefs que querían rescatar las recetas de sus abuelas con un toque contemporáneo. La cocina es 100% criolla: ropa vieja, lechón asado, picadillo habanero, tostones y yuca con mojo. Los fines de semana hay música en vivo — son cubano, jazz, o trova según el día. El lugar tiene terraza interior con plantas tropicales y una barra de cocktails con rones cubanos premium. Aceptan MLC, CUP y efectivo en USD. Reservaciones recomendadas los viernes y sábados.",
  isOpen: true,
  closedMessage: "Abre mañana a las 12:00 PM",
  aiQuery: "restaurante tranquilo con comida criolla cerca de Vedado",
  aiReasoning:
    "La Guarida está a 1.2 km de tu ubicación, tiene reputación de ambiente relajado y cocina tradicional cubana. Es ideal para una cena sin prisa — aceptan MLC y tarjeta. Los fines de semana tienen música en vivo.",
  aiTags: ["Cerca de ti", "Comida criolla", "Ambiente tranquilo", "Acepta MLC"],
  slides: [
    { gradient: "linear-gradient(160deg, oklch(45% 0.08 145), oklch(35% 0.06 145))", label: "Fachada colonial" },
    { gradient: "linear-gradient(160deg, oklch(50% 0.06 85), oklch(40% 0.05 85))", label: "Interior art déco" },
    { gradient: "linear-gradient(160deg, oklch(55% 0.10 75), oklch(42% 0.08 75))", label: "Plato signature" },
    { gradient: "linear-gradient(160deg, oklch(40% 0.04 250), oklch(30% 0.03 250))", label: "Terraza nocturna" },
  ],
  menu: [
    {
      name: "Ropa Vieja Tradicional",
      description: "Carne desmechada con sofrito cubano, arroz blanco y plátanos maduros",
      price: 450,
      currency: "CUP",
      tag: { label: "Popular", variant: "popular" },
    },
    {
      name: "Lechón Asado",
      description: "Cerdo asado lentamente con mojo criollo, yuca y ensalada de aguacate",
      price: 12,
      currency: "MLC",
      tag: { label: "Nuevo", variant: "new" },
    },
    {
      name: "Cóctel de la Casa",
      description: "Ron añejo, jugo de maracuyá, hierbabuena y un toque de miel de abeja",
      price: 5,
      currency: "MLC",
      tag: { label: "2x1", variant: "offer" },
    },
    {
      name: "Tostones con Mojo",
      description: "Plátano verde frito con ajo, naranja agria y cebolla morada",
      price: 200,
      currency: "CUP",
    },
  ],
  specialOffer: {
    label: "Oferta especial",
    text: "2x1 en cócteles artesanales de martes a jueves, 6PM – 9PM",
    expiry: "Válido hasta el 15 de agosto · Presentar al pedir",
  },
};

export default function PlacePage() {
  const params = useParams();
  const router = useRouter();

  return (
    <PlaceDetail
      place={MOCK_PLACE}
      onBack={() => router.back()}
      onShare={() => {}}
      onMenuSeeAll={() => {}}
    />
  );
}
