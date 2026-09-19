"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowLeft } from "lucide-react";
import { BusinessForm } from "@/components/admin/business-form";
import { StateView } from "@/components/ui/state-view";
import { LoadingState } from "@/components/ui/loading";
import { usePlaces } from "@/providers/places-provider";

export default function EditarNegocioPage() {
  const params = useParams();
  const router = useRouter();
  const { places, hydrated } = usePlaces();

  const id = typeof params.id === "string" ? params.id : "";

  // Mismo motivo que en la ficha pública: durante el primer render `places`
  // todavía está vacío y el formulario mostraba "Negocio no encontrado".
  if (!hydrated) {
    return <LoadingState className="py-20" />;
  }

  const place = places.find((p) => p.id === id) ?? null;

  if (!place) {
    return (
      <StateView
        icon={MapPin}
        title="Negocio no encontrado"
        description="Este negocio no existe o fue eliminado."
        className="py-20"
        actions={
          <Link
            href="/admin/negocios"
            className="inline-flex items-center gap-[6px] h-11 px-gap-lg rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] hover:bg-verde-300 transition-all duration-500 ease-outquint active:scale-[0.98]"
          >
            <ArrowLeft size={16} strokeWidth={1.8} />
            Volver a negocios
          </Link>
        }
      />
    );
  }

  return (
    <BusinessForm
      key={place.id}
      initial={place}
      onDone={() => router.push("/admin/negocios")}
    />
  );
}
