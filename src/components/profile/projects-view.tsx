"use client";

import { ArrowLeft } from "lucide-react";
import { BusinessView } from "@/components/profile/business-view";
import { ProjectRegistrationForm } from "@/components/profile/project-registration-form";

export type ProjectFlow = "business" | "registration";

/**
 * El alta de negocio y de proyecto. Ya no tiene portada propia: las dos
 * tarjetas que la abrían viven ahora en «Info», así que aquí solo queda la
 * puerta de vuelta y el formulario que se haya elegido.
 */
export function ProjectsView({
  flow,
  onBack,
}: {
  flow: ProjectFlow;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-gap-sm inline-flex items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-700"
      >
        <ArrowLeft size={16} />
        Volver a Info
      </button>
      {flow === "business" ? (
        <BusinessView />
      ) : (
        <ProjectRegistrationForm onBack={onBack} />
      )}
    </div>
  );
}
