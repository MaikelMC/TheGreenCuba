"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowLeft } from "lucide-react";
import { BusinessForm } from "@/components/admin/business-form";
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
      <div className="flex flex-col items-center justify-center gap-gap-md text-center py-20">
        <div className="size-16 rounded-full bg-accent/10 grid place-items-center text-accent">
          <MapPin size={26} strokeWidth={1.8} />
        </div>
        <h1 className="font-display text-h3 font-bold text-foreground">
          Negocio no encontrado
        </h1>
        <p className="text-small text-muted-foreground max-w-[30ch]">
          Este negocio no existe o fue eliminado.
        </p>
        <Link
          href="/admin/negocios"
          className="inline-flex items-center gap-2 px-5 py-[10px] bg-accent text-white rounded-lv font-display text-[14px] font-semibold hover:bg-accent-hover transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Volver a negocios
        </Link>
      </div>
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
