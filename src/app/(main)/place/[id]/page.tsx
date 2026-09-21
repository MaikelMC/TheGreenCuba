"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowLeft } from "lucide-react";
import { StateView } from "@/components/ui/state-view";
import { LoadingState } from "@/components/ui/loading";
import {
  PlaceDetail,
  type PlaceData,
  type PlaceState,
} from "@/components/place/place-detail";
import { usePlaces } from "@/providers/places-provider";
import type { UserPlace } from "@/lib/places-store";

/* Mismo par de degradados claros que usa el editor de fotos del panel de
   negocio. Los anteriores eran verdes oscuros y el rótulo del carrusel —que va
   en `verde-600`— no se leía encima.

   El `url: null` es lo que los marca como relleno: `PhotoCarousel` pinta el
   degradado en lugar de una imagen. */
const FALLBACK_SLIDES = [
  {
    url: null,
    alt: "",
    gradient: "linear-gradient(160deg, #EAF7EF, #CEEEDB)",
    label: "El lugar",
  },
  {
    url: null,
    alt: "",
    gradient: "linear-gradient(160deg, #F6F3EC, #EAE4D6)",
    label: "Ambiente",
  },
];

function userPlaceToPlaceData(p: UserPlace): PlaceData {
  const isOpen = p.status === "active";
  const tags = p.aiTags ? [...p.aiTags] : [];
  if (p.isBoosted && !tags.includes("Destacado")) tags.unshift("Destacado");
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    rating: p.rating ?? 0,
    /* Sin el respaldo "Ver en el mapa" que había aquí: cuando no hay ni
       distancia ni dirección el campo queda vacío y la ficha esconde la línea,
       en vez de anunciar un mapa que no lleva a ninguna parte. */
    distance: p.distanceLabel || p.address || "",
    barrio: p.barrio || "Cuba",
    schedule: p.schedule || "Próximamente",
    payments: p.payments,
    description: p.description,
    longDescription:
      p.description ||
      "Negocio agregado por su dueño en La Verde. Pronto tendrá más información, horarios y fotos.",
    isOpen,
    closedMessage:
      p.status === "closed"
        ? "Cerrado temporalmente."
        : p.status === "temporary_closed"
          ? "Temporalmente cerrado."
          : undefined,
    aiQuery: `buscar ${p.category.toLowerCase()} en Cuba`,
    aiReasoning:
      p.aiReasoning ||
      `Este negocio está en ${p.barrio || "Cuba"}, listo para ser recomendado por La Verde.`,
    aiTags: tags.length > 0 ? tags : ["Nuevo en La Verde"],
    /* Las fotos subidas mandan; el degradado solo rellena cuando el negocio
       todavía no tiene ninguna. */
    slides:
      p.photos && p.photos.length > 0
        ? p.photos.map((photo, i) => ({
            url: photo.url,
            alt: photo.alt || `Foto ${i + 1} de ${p.name}`,
          }))
        : FALLBACK_SLIDES.map((s) => ({ ...s, label: `${p.name}: ${s.label}` })),
    menu: p.menu
      .filter((item) => item.name.trim().length > 0)
      .map((item) => ({
        name: item.name,
        description: item.description,
        price: Number(item.price) || 0,
        currency: item.currency || "MLC",
      })),
    specialOffer: p.offer
      ? {
          label: "Oferta especial",
          text: p.offer.text,
          expiry: p.offer.expiry,
        }
      : undefined,
  };
}

function placeState(p: UserPlace): PlaceState {
  /* La oferta va primero y el orden importa: en `PlaceDetail` el banner solo se
     pinta con el estado `special-offer`, así que un negocio con fotos y oferta
     perdería el banner si las fotos se comprobaran antes. */
  if (p.offer) return "special-offer";
  if (p.photos && p.photos.length > 0) return "normal";
  return "no-photos";
}

export default function PlacePage() {
  const params = useParams();
  const router = useRouter();
  const { places, hydrated } = usePlaces();

  const id = typeof params.id === "string" ? params.id : "";

  // `places` se llena en un useEffect del provider, así que en el primer render
  // está vacío. Sin esta guarda no se puede distinguir "todavía no cargó" de
  // "no existe", y la página mostraba "Lugar no encontrado" un instante antes
  // de encontrar el lugar, al recargar o entrar por URL directa.
  if (!hydrated) {
    return <LoadingState className="min-h-screen min-h-dvh" />;
  }

  const place = places.find((p) => p.id === id) ?? null;

  if (!place) {
    return (
      <div className="grid min-h-screen min-h-dvh place-items-center bg-sand font-lv text-ink px-gutter">
        <StateView
          icon={MapPin}
          title="Lugar no encontrado"
          description="Este lugar no está en La Verde o fue eliminado."
          actions={
            <Link
              href="/home"
              className="inline-flex items-center gap-[6px] h-11 px-gap-lg rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] hover:bg-verde-300 transition-all duration-500 ease-outquint active:scale-[0.98]"
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
              Volver al mapa
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <PlaceDetail
      place={userPlaceToPlaceData(place)}
      state={placeState(place)}
      onBack={() => router.back()}
      onShare={() => {}}
      onMenuSeeAll={() => {}}
      onNavigate={() => router.push(`/home?lugar=${place.id}`)}
    />
  );
}
