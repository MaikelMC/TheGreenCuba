"use client";

import { useRouter } from "next/navigation";
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
    /* Lo que la tarjeta de recomendación dice sale de aquí y solo de aquí: sin
       frase de relleno, sin consulta inventada y sin `aiReasoning`, que viajaba
       en `UserPlace` pero no tiene columna en `places` y llegaba siempre vacío. */
    vibe: p.vibe ?? [],
    aiTags: p.aiTags ?? [],
    priceLabel: p.priceLabel,
    isBoosted: p.isBoosted,
    /* Las fotos subidas mandan; el degradado solo rellena cuando el negocio
       todavía no tiene ninguna. */
    slides:
      p.photos && p.photos.length > 0
        ? p.photos.map((photo, i) => ({
            url: photo.url,
            alt: photo.alt || `Foto ${i + 1} de ${p.name}`,
          }))
        : FALLBACK_SLIDES.map((s) => ({ ...s, label: `${p.name}: ${s.label}` })),
    /* El precio pasa tal cual y la chapita también. Aquí estaba el corte de la
       cadena: `Number(item.price) || 0` convertía a cero todo precio que no
       fuese una cifra pelada —el campo es texto libre, el propio esquema pone
       «3–5 USD» de ejemplo— y la reconstrucción del objeto se dejaba fuera el
       `tag` que el dueño había escrito. */
    menu: p.menu
      .filter((item) => item.name.trim().length > 0)
      .map((item) => ({
        name: item.name,
        description: item.description,
        price: item.price,
        currency: item.currency || "MLC",
        tag: item.tag,
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

/**
 * La ficha, en el navegador.
 *
 * Es un componente de cliente y lo seguirá siendo: el carrusel, el menú y las
 * acciones son interacción pura. Lo que cambió es de dónde sale el lugar.
 *
 * `initialPlace` llega ya resuelto del servidor, y con él la página se pinta
 * entera en el HTML inicial: antes el lugar salía de `usePlaces()`, que pide el
 * catálogo en un `useEffect`, así que el servidor no emitía **ni el nombre del
 * negocio** y quien no ejecutara JavaScript —o el buscador que decide no
 * hacerlo— veía una página vacía. El catálogo del cliente sigue mandando cuando
 * está: es el que se actualiza al editar, y es más fresco que el de la petición.
 */
export function PlaceView({
  id,
  initialPlace = null,
}: {
  id: string;
  initialPlace?: UserPlace | null;
}) {
  const router = useRouter();
  const { places, hydrated } = usePlaces();

  const place = places.find((p) => p.id === id) ?? initialPlace;

  /* Sin lugar del servidor hay que esperar al catálogo para poder distinguir
     "todavía no cargó" de "no existe", y sin esa guarda la página mostraba
     "Lugar no encontrado" un instante antes de encontrar el lugar, al recargar o
     entrar por URL directa. Con el lugar del servidor no hay nada que esperar. */
  if (!place && !hydrated) {
    return <LoadingState className="min-h-screen min-h-dvh" />;
  }

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
