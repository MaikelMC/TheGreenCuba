"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowLeft, Upload } from "lucide-react";
import { BusinessForm } from "@/components/admin/business-form";
import { PackMedidaEditor } from "@/components/admin/pack-medida-editor";
import { SuscripcionEditor } from "@/components/admin/suscripcion-editor";
import { VinculoEditor } from "@/components/admin/vinculo-editor";
import { StateView } from "@/components/ui/state-view";
import { LoadingState } from "@/components/ui/loading";
import { usePlaces } from "@/providers/places-provider";

/* Los editores de abajo (plan, pack, dueño) guardan aparte y dejan una marca
   `data-sin-guardar` mientras tienen cambios pendientes. Se mira el DOM y no un
   estado compartido: son tres componentes independientes y así no hace falta
   cablearlos entre sí. */
const haySinGuardar = () =>
  typeof document !== "undefined" &&
  document.querySelector("[data-sin-guardar]") !== null;

export default function EditarNegocioPage() {
  const params = useParams();
  const router = useRouter();
  const { places, hydrated } = usePlaces();

  /* Recargar o cerrar la pestaña con cambios pendientes: el aviso nativo. */
  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => {
      if (haySinGuardar()) e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, []);

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
            className="inline-flex items-center gap-[6px] h-11 px-gap-lg rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo hover:bg-verde-300 transition duration-500 ease-outquint active:scale-[0.98]"
          >
            <ArrowLeft size={16} strokeWidth={1.8} />
            Volver a negocios
          </Link>
        }
      />
    );
  }

  return (
    <>
      <BusinessForm
        key={place.id}
        initial={place}
        /* Guardar la ficha volvía a la lista y se llevaba por delante lo que
           hubiera sin guardar en el plan, el pack o el dueño. */
        onDone={() => {
          if (
            haySinGuardar() &&
            !window.confirm(
              "La ficha se guardó, pero hay cambios sin guardar en el plan, el pack o el dueño. ¿Volver a la lista y perderlos?",
            )
          ) {
            return;
          }
          router.push("/admin/negocios");
        }}
      />
      {/* El plan va aparte del formulario de la ficha y no dentro: se guarda
          contra otra tabla y con otra ruta, así que meterlo en el `save` de la
          ficha habría atado dos escrituras que no tienen nada que ver. */}
      <div className="mt-gap-lg">
        <SuscripcionEditor placeId={place.id} />
      </div>
      <div className="mt-gap-lg">
        <PackMedidaEditor placeId={place.id} />
      </div>
      {/* El dueño va aparte por el mismo motivo que el plan: escribe otra tabla
          —`business_owners`— y por otra ruta. */}
      <div className="mt-gap-lg">
        <VinculoEditor placeId={place.id} />
      </div>
      {/* La importación por CSV vive en su propia pantalla: da de alta decenas
          de productos con vista previa, y meterla en el `save` de la ficha
          habría atado dos escrituras que no tienen nada que ver. */}
      <div className="mt-gap-lg">
        <Link
          href={`/admin/negocios/${place.id}/importar`}
          className="inline-flex items-center gap-gap-xs h-11 px-gap-lg rounded-full bg-white border border-ink/10 text-ink font-lv-display text-small font-semibold hover:border-verde-300 hover:text-verde-600 transition duration-500 ease-outquint"
        >
          <Upload size={16} strokeWidth={1.8} />
          Importar catálogo por CSV
        </Link>
      </div>
    </>
  );
}
