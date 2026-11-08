"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { navegar } from "@/lib/navegar";
import { MapPin, ArrowLeft } from "lucide-react";
import type { UserPlace } from "@/lib/places-store";
import { userPlaceToPlaceData, type PlaceState } from "@/lib/ficha/place-data";
import { ofertasVigentes } from "@/lib/ofertas";
import { usePlaces } from "@/providers/places-provider";
import { LoadingState } from "@/components/ui/loading";
import { StateView } from "@/components/ui/state-view";
import { PlaceDetail } from "@/components/place/place-detail";
import { sharePlace } from "@/lib/share";
import type { ConfigTasa } from "@/lib/precios";

/**
 * El estado que decide cartel y portada. La oferta va primero y el orden
 * importa: en la ficha el cartel solo se pinta con estado `oferta`, así que un
 * negocio con fotos y oferta perdería el cartel si las fotos se comprobaran
 * antes.
 */
function placeState(p: UserPlace): PlaceState {
  if (ofertasVigentes(p.ofertas).length > 0) return "oferta";
  if (p.photos && p.photos.length > 0) return "normal";
  return "no-photos";
}

/**
 * La ficha, en el navegador.
 *
 * `initialPlace` llega ya resuelto del servidor, y con él la página se pinta
 * entera en el HTML inicial. El catálogo del cliente solo hace de respaldo
 * cuando el servidor no encontró el lugar (o la consulta falló).
 *
 * La traducción `UserPlace → PlaceData` vive en `@/lib/ficha/place-data`, no
 * aquí: la comparte la vista previa del panel y tiene su propia prueba.
 */
export function PlaceView({
  id,
  initialPlace = null,
  nowIso,
  configTasa = null,
}: {
  id: string;
  initialPlace?: UserPlace | null;
  /** El «ahora» del servidor, para que el estado de apertura no se hidrate mal. */
  nowIso?: string;
  configTasa?: ConfigTasa | null;
}) {
  const router = useRouter();
  const { places, hydrated } = usePlaces();

  const place = initialPlace ?? places.find((p) => p.id === id);

  if (!place && !hydrated) {
    return <LoadingState className="min-h-screen min-h-dvh" />;
  }

  if (!place) {
    return (
      <div className="grid min-h-screen min-h-dvh place-items-center bg-sand px-gutter font-lv text-ink">
        <StateView
          icon={MapPin}
          title="Lugar no encontrado"
          description="Este lugar no está en La Verde o fue eliminado."
          actions={
            <Link
              href="/home"
              className="inline-flex items-center gap-[6px] h-11 px-gap-lg rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo hover:bg-verde-300 transition duration-500 ease-outquint active:scale-[0.98]"
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
         despliegue viajaría de un lugar al siguiente. La `key` la remonta. */
      key={place.id}
      place={userPlaceToPlaceData(place)}
      state={placeState(place)}
      onBack={() => router.back()}
      onShare={() => sharePlace(place.id, place.name)}
      onNavigate={() => navegar(`/home?lugar=${place.id}`, router.push)}
      nowIso={nowIso}
      configTasa={configTasa}
    />
  );
}
