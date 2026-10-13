"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Upload } from "lucide-react";
import { ImportarCatalogo } from "@/components/admin/importar-catalogo";
import { StateView } from "@/components/ui/state-view";
import { LoadingState } from "@/components/ui/loading";
import { usePlaces } from "@/providers/places-provider";

/**
 * Importar el catálogo de un negocio desde un CSV.
 *
 * Vive como pantalla propia y no dentro del formulario de la ficha porque es
 * otra cosa: el formulario guarda un negocio que ya existe, y esto da de alta
 * decenas de productos de golpe, con su vista previa y su deshacer. Meterlo en
 * el `save` del formulario habría atado dos escrituras que no se parecen.
 */
export default function ImportarCatalogoPage() {
  const params = useParams();
  const { places, hydrated } = usePlaces();

  const id = typeof params.id === "string" ? params.id : "";

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
            className="inline-flex items-center gap-[6px] h-11 px-gap-lg rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo hover:bg-verde-300 transition-all duration-500 ease-outquint active:scale-[0.98]"
          >
            <ArrowLeft size={16} strokeWidth={1.8} />
            Volver a negocios
          </Link>
        }
      />
    );
  }

  /* Solo lo que hace falta para detectar duplicados: el nombre y la categoría
     de cada producto que ya está en la carta. */
  const existentes = place.menu.map((item) => ({
    nombre: item.name,
    categoria: item.category,
  }));

  return (
    <>
      <div className="mb-gap-lg flex flex-col gap-gap-xs">
        <Link
          href={`/admin/negocios/${place.id}/editar`}
          className="inline-flex items-center gap-[6px] w-fit text-meta text-ink-soft/75 hover:text-verde-600 transition-colors duration-500 ease-outquint"
        >
          <ArrowLeft size={14} strokeWidth={1.8} />
          Volver a la ficha
        </Link>
        <h1 className="inline-flex items-center gap-gap-xs font-lv-display text-title text-ink">
          <Upload size={20} strokeWidth={1.8} className="text-verde-600" />
          Importar catálogo
        </h1>
        <p className="text-small text-ink-soft/75">
          Carga de una sola vez los productos de «{place.name}» desde un CSV.
        </p>
      </div>

      <ImportarCatalogo key={place.id} placeId={place.id} existentes={existentes} />
    </>
  );
}
