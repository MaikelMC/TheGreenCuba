"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Megaphone, Store } from "lucide-react";
import { BusinessView } from "@/components/profile/business-view";
import { ProjectRegistrationForm } from "@/components/profile/project-registration-form";

export function ProjectsView() {
  const [mode, setMode] = useState<"choices" | "business-options" | "registration" | "business">("choices");

  if (mode === "business") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setMode("choices")}
          className="mb-gap-sm inline-flex items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-700"
        >
          <ArrowLeft size={16} />
          Volver a Proyectos
        </button>
        <BusinessView />
      </div>
    );
  }

  if (mode === "business-options") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setMode("choices")}
          className="mb-gap-sm inline-flex items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-700"
        >
          <ArrowLeft size={16} />
          Volver a Proyectos
        </button>
        <div>
          <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">
            Tengo un negocio o una idea
          </p>
          <h2 className="mt-gap-xs font-lv-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">
            ¿Qué quieres registrar?
          </h2>
          <div className="mt-gap-lg grid gap-gap-md sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("business")}
              className="group flex min-h-[190px] flex-col justify-between rounded-[24px] border border-ink/10 bg-white p-gap-lg text-left shadow-[0_18px_50px_-32px_rgba(20,42,30,0.55)] transition-all duration-500 hover:-translate-y-1 hover:border-verde-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
            >
              <span>
                <Store className="text-verde-700" size={24} strokeWidth={1.8} />
                <span className="mt-gap-md block font-lv-display text-[21px] font-bold text-ink">Registrar negocio</span>
                <span className="mt-gap-xs block text-small leading-relaxed text-ink-soft/75">Un lugar permanente con ficha, horarios y servicios.</span>
              </span>
              <span className="flex items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-700">Continuar <ArrowRight size={17} /></span>
            </button>
            <button
              type="button"
              onClick={() => setMode("registration")}
              className="group flex min-h-[190px] flex-col justify-between rounded-[24px] border border-ink/10 bg-ink p-gap-lg text-left text-white transition-all duration-500 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
            >
              <span>
                <Megaphone className="text-verde-300" size={24} strokeWidth={1.8} />
                <span className="mt-gap-md block font-lv-display text-[21px] font-bold">Registrar proyecto</span>
                <span className="mt-gap-xs block text-small leading-relaxed text-white/70">Una actividad temporal o itinerante, como una presentación musical.</span>
              </span>
              <span className="flex items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-300">Continuar <ArrowRight size={17} /></span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "registration") {
    return <ProjectRegistrationForm onBack={() => setMode("choices")} />;
  }

  return (
    <section className="flex flex-col gap-gap-lg">
      <div>
        <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">
          Tengo un negocio
        </p>
        <h2 className="mt-gap-xs font-lv-display text-[clamp(28px,7vw,42px)] font-bold leading-[0.98] tracking-[-0.03em] text-ink">
          ¿Qué quieres agregar?
        </h2>
        <p className="mt-gap-sm text-body leading-relaxed text-ink-soft/80">
          Puedes registrar un negocio permanente o un proyecto temporal e itinerante.
        </p>
      </div>

      <div className="grid gap-gap-md">
        <div className="flex min-h-[210px] flex-col justify-between rounded-[24px] border border-ink/10 bg-white p-gap-lg shadow-[0_18px_50px_-32px_rgba(20,42,30,0.55)]">
          <span>
            <span className="grid size-12 place-items-center rounded-2xl bg-verde-50 text-verde-700">
              <Store size={24} strokeWidth={1.8} />
            </span>
            <span className="mt-gap-md block font-lv-display text-[23px] font-bold tracking-[-0.02em] text-ink">
              Registrar un negocio
            </span>
            <span className="mt-gap-xs block text-small leading-relaxed text-ink-soft/75">
              Agrega un local o actividad permanente con horarios, fotos y servicios.
            </span>
          </span>
          <div className="mt-gap-md flex flex-wrap gap-gap-xs">
            <button
              type="button"
              onClick={() => setMode("business")}
              className="inline-flex h-10 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 transition-colors hover:bg-verde-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
            >
              Agregar negocio <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMode("registration")}
          className="group flex min-h-[210px] flex-col justify-between rounded-[24px] border border-ink/10 bg-ink p-gap-lg text-left text-white transition-all duration-500 ease-outquint hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400"
        >
          <span>
            <span className="grid size-12 place-items-center rounded-2xl bg-verde-300 text-verde-950">
              <Megaphone size={24} strokeWidth={1.8} />
            </span>
            <span className="mt-gap-md block font-lv-display text-[23px] font-bold tracking-[-0.02em]">
              Registrar un proyecto
            </span>
            <span className="mt-gap-xs block text-small leading-relaxed text-white/70">
              Organiza un evento, colaboración o experiencia con fecha, ofertas y reservas.
            </span>
          </span>
          <span className="flex items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-300">
            Agregar proyecto <ArrowRight size={16} className="transition-transform duration-500 group-hover:translate-x-1" />
          </span>
        </button>
      </div>
    </section>
  );
}