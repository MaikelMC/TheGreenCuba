"use client";

import type { Metadata } from "next";
import { cache } from "react";
import { getPlaceById } from "@/lib/db/queries";
import { placeJsonLd, placeUrl } from "@/lib/structured-data";
import type {
  UserPlace,
  UserPlacePhoto,
  UserPlaceMenuItem,
} from "@/lib/places-store";
import type { PlaceData } from "@/components/place/place-detail";
import { contactLinks } from "@/lib/contact-links";
import { formatDateRange } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { usePlaces } from "@/providers/places-provider";
import { LoadingState } from "@/components/ui/loading";
import { StateView } from "@/components/ui/state-view";
import { MapPin, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PlaceDetail } from "@/components/place/place-detail";
import { sharePlace } from "@/lib/share";

const FALLBACK_SLIDES = [
  {
    url: null,
    alt: "",
    gradient: "linear-gradient(160deg, #EAF7EF, #CEEEDB)", // verde-50 → verde-100
    label: "El lugar",
  },
  {
    url: null,
    alt: "",
    gradient: "linear-gradient(160deg, #F6F3EC, #EAE4D6)", // sand → sand-deep
    label: "Ambiente",
  },
];

function userPlaceToPlaceData(p: UserPlace): PlaceData {
  const isOpen = p.status === "active";
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    isProject: p.isProject ?? false,
    projectOffers: p.isProject ? (p.offer?.text ?? null) : null,
    projectOfferPackages: p.isProject ? (p.offerPackages ?? []) : [],
    rating: p.rating ?? 0,
    /* Sin el respaldo "Ver en el mapa" que había aquí: cuando no hay ni
       distancia ni dirección el campo queda vacío y la ficha esconde la línea,
       en vez de anunciar un mapa que no lleva a ninguna parte. */
    distance: p.distanceLabel || p.address || "",
    address: p.address,
    logoUrl: p.logoUrl,
    barrio: p.barrio || "Cuba",
    /* Las fechas de un proyecto, legibles: la base las guarda como
       «2026-08-12 a 2026-08-20» y ese es el dato por el que se decide si ir. */
    schedule:
      p.isProject && p.schedule
        ? formatDateRange(p.schedule)
        : p.schedule || "Próximamente",
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
    icon: p.icon,
    isBoosted: p.isBoosted,
    /* Las fotos subidas mandan; el degradado solo rellena cuando el negocio
       todavía no tiene ninguna. */
    slides:
      p.photos && p.photos.length > 0
        ? p.photos.map((photo: UserPlacePhoto, i: number) => ({
            url: photo.url,
            alt: photo.alt || `Foto ${i + 1} de ${p.name}`,
          }))
        : FALLBACK_SLIDES.map(
            (s: {
              url: null | string;
              alt: string;
              gradient: string;
              label: string;
            }) => ({
              ...s,
              label: `${p.name}: ${s.label}`,
            }),
          ),
    /* El precio pasa tal cual y la chapita también. Aquí estaba el corte de la
       cadena: `Number(item.price) || 0` convertía a cero todo precio que no
       fuese una cifra pelada —el campo es texto libre, el propio esquema pone
       «3–5 USD» de ejemplo— y la reconstrucción del objeto se dejaba fuera el
       `tag` que el dueño había escrito. */
    menu: p.menu
      .filter((item) => item.name.trim().length > 0)
      .map((item: UserPlaceMenuItem) => ({
        name: item.name,
        description: item.description,
        price: item.price,
        currency: item.currency || "MLC",
        tag: item.tag,
        category: item.category,
        image: item.image,
        /* «Hoy hay»: sin esto la ficha perdería el estado y un producto agotado
           se vería como disponible. La reconstrucción es explícita, así que
           todo lo que no se nombre aquí se cae. */
        disponibilidad: item.disponibilidad,
        agotadoHasta: item.agotadoHasta,
      })),
    specialOffer: p.offer
      ? {
          label: "Oferta especial",
          text: p.offer.text,
          expiry: p.offer.expiry,
        }
      : undefined,
    /* Aquí y no en `PlaceDetail`: normalizar es traducir lo de la base, y la
       ficha solo pinta. El `whatsapp` no cae al teléfono de la ficha, aunque
       parezcan lo mismo: el botón promete una conversación y un teléfono fijo
       no la abre —el dueño que quiera el botón llena el suyo. */
    contact: contactLinks({
      website: p.website,
      whatsapp: p.whatsapp,
      instagram: p.instagram,
      facebook: p.facebook,
    }),
  };
}

function placeState(
  p: UserPlace,
): "normal" | "closed" | "no-photos" | "special-offer" {
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
              className="inline-flex items-center gap-[6px] h-11 px-gap-lg rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo hover:bg-verde-300 transition-all duration-500 ease-outquint active:scale-[0.98]"
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
      /* Al cambiar de ficha, React reutiliza la instancia y el estado de
         despliegue —descripción, oferta del proyecto— viajaba de un lugar al
         siguiente: entrabas en otro y salía abierto. La `key` la remonta. */
      key={place.id}
      place={userPlaceToPlaceData(place)}
      state={placeState(place)}
      onBack={() => router.back()}
      onShare={() => sharePlace(place.id, place.name)}
      onNavigate={() => router.push(`/home?lugar=${place.id}`)}
    />
  );
}
