"use client";

import { useState } from "react";
import { Megaphone, Store } from "lucide-react";
import { ProjectRequestsList } from "@/components/admin/project-requests-list";
import { RequestsList } from "@/components/admin/requests-list";

type RequestKind = "businesses" | "projects";

export function CombinedRequests() {
  const [kind, setKind] = useState<RequestKind>("businesses");

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-gap-lg">
      <header>
        <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">Moderación</p>
        <h1 className="mt-gap-xs font-lv-display text-[clamp(28px,5vw,44px)] font-bold text-ink">Solicitudes</h1>
        <p className="mt-gap-sm text-body text-ink-soft/75">Revisa las propuestas de negocios y proyectos antes de publicarlas.</p>
      </header>

      <div role="tablist" aria-label="Tipo de solicitud" className="flex w-fit max-w-full gap-1 rounded-full border border-ink/10 bg-white p-1">
        <button
          type="button"
          role="tab"
          aria-selected={kind === "businesses"}
          onClick={() => setKind("businesses")}
          className={`inline-flex h-10 items-center gap-gap-xs rounded-full px-gap-md font-lv-display text-small font-semibold transition-colors ${kind === "businesses" ? "bg-verde-50 text-verde-700" : "text-ink-soft/75 hover:bg-sand"}`}
        >
          <Store size={16} /> Negocios
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === "projects"}
          onClick={() => setKind("projects")}
          className={`inline-flex h-10 items-center gap-gap-xs rounded-full px-gap-md font-lv-display text-small font-semibold transition-colors ${kind === "projects" ? "bg-verde-50 text-verde-700" : "text-ink-soft/75 hover:bg-sand"}`}
        >
          <Megaphone size={16} /> Proyectos
        </button>
      </div>

      {kind === "businesses" ? <RequestsList /> : <ProjectRequestsList />}
    </section>
  );
}