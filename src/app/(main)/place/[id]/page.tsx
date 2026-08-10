"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowLeft } from "lucide-react";
import {
  PlaceDetail,
  type PlaceData,
  type PlaceState,
} from "@/components/place/place-detail";
import { usePlaces } from "@/providers/places-provider";
import type { UserPlace } from "@/lib/places-store";

const FALLBACK_SLIDES = [
  {
    gradient: "linear-gradient(160deg, oklch(45% 0.08 145), oklch(35% 0.06 145))",
    label: "El lugar",
  },
  {
    gradient: "linear-gradient(160deg, oklch(50% 0.06 85), oklch(40% 0.05 85))",
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
    distance: p.distanceLabel || p.address || p.barrio || "Ver en el mapa",
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
    slides:
      p.slides && p.slides.length > 0
        ? p.slides
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
  if (p.offer) return "special-offer";
  if (p.slides && p.slides.length > 0) return "normal";
  return "no-photos";
}

export default function PlacePage() {
  const params = useParams();
  const router = useRouter();
  const { places } = usePlaces();

  const id = typeof params.id === "string" ? params.id : "";
  const place = places.find((p) => p.id === id) ?? null;

  if (!place) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-gap-md px-gutter text-center">
        <div className="size-16 rounded-full bg-accent/10 grid place-items-center text-accent">
          <MapPin size={26} strokeWidth={1.8} />
        </div>
        <h1 className="font-display text-h3 font-bold text-foreground">
          Lugar no encontrado
        </h1>
        <p className="text-small text-muted-foreground max-w-[30ch]">
          Este lugar no está en La Verde o fue eliminado.
        </p>
        <Link
          href="/home"
          className="inline-flex items-center gap-2 px-5 py-[10px] bg-accent text-white rounded-lv font-display text-[14px] font-semibold hover:bg-accent-hover transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Volver al mapa
        </Link>
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
