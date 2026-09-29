"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Clock3,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  MapPin,
  Megaphone,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileDock } from "@/components/layout/mobile-dock";
import { ProjectPhotoManager } from "@/components/profile/project-photo-manager";
import { ProjectRegistrationForm, type ProjectFormProject } from "@/components/profile/project-registration-form";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

type ProjectPanelView = "dashboard" | "editor" | "photos" | "publication";

interface PanelItem {
  id: ProjectPanelView;
  label: string;
  short: string;
  icon: LucideIcon;
}

const PANEL_ITEMS: PanelItem[] = [
  { id: "dashboard", label: "Resumen", short: "Resumen", icon: LayoutDashboard },
  { id: "editor", label: "Editar proyecto", short: "Editar", icon: Pencil },
  { id: "photos", label: "Fotos", short: "Fotos", icon: ImageIcon },
  { id: "publication", label: "Publicación", short: "Estado", icon: BadgeCheck },
];

const STATUS: Record<ProjectFormProject["status"], string> = {
  pending: "En revisión",
  approved: "Publicado",
  rejected: "Necesita cambios",
};

export function ProjectManagementPanel() {
  const [projects, setProjects] = useState<ProjectFormProject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ProjectPanelView>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/project-requests?mine=true");
      if (!response.ok) throw new Error("No se pudieron cargar tus proyectos.");
      const data = (await response.json()) as ProjectFormProject[];
      setProjects(data);
      setSelectedId((current) => current && data.some((project) => project.id === current)
        ? current
        : data[0]?.id ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar tus proyectos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const project = projects.find((item) => item.id === selectedId) ?? null;

  function updateProject(patch: Partial<ProjectFormProject>) {
    if (!project) return;
    setProjects((current) => current.map((item) => item.id === project.id ? { ...item, ...patch } : item));
  }

  function viewContent() {
    if (!project) return null;

    if (view === "editor") {
      return (
        <ProjectRegistrationForm
          key={project.id}
          project={project}
          showPhotos={false}
          onBack={() => setView("dashboard")}
          onSaved={() => {
            setView("dashboard");
            void loadProjects();
          }}
        />
      );
    }

    if (view === "photos") {
      return <ProjectPhotoManager project={project} onUpdated={updateProject} />;
    }

    if (view === "publication") {
      return (
        <section className="flex flex-col gap-gap-md">
          <header>
            <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">Visibilidad</p>
            <h1 className="mt-gap-xs font-lv-display text-[26px] font-bold text-ink">Publicación del proyecto</h1>
          </header>
          <div className="flex items-start gap-gap-sm rounded-2xl border border-ink/10 bg-white p-gap-md">
            {project.status === "approved" ? <BadgeCheck className="mt-0.5 text-verde-600" /> : <Clock3 className="mt-0.5 text-ink-soft/65" />}
            <div>
              <p className="font-lv-display text-small font-semibold text-ink">{STATUS[project.status]}</p>
              <p className="mt-1 text-small text-ink-soft/75">
                {project.status === "approved"
                  ? "Tu proyecto aparece en el mapa y en las recomendaciones."
                  : project.status === "rejected"
                    ? "Revisa el motivo, actualiza la planilla y vuelve a enviarlo a revisión."
                    : "El equipo de La Verde está revisando los datos antes de publicarlo."}
              </p>
            </div>
          </div>
          {project.status === "rejected" && project.adminNote && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-gap-md">
              <h2 className="font-lv-display text-small font-semibold text-red-800">Motivo de los cambios solicitados</h2>
              <p className="mt-1 text-small leading-relaxed text-red-700">{project.adminNote}</p>
            </div>
          )}
          <button type="button" onClick={() => setView("editor")} className="inline-flex h-11 w-fit items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 hover:bg-verde-300">
            <Pencil size={16} /> Editar proyecto
          </button>
        </section>
      );
    }

    return (
      <section className="flex flex-col gap-gap-lg">
        <header>
          <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">Resumen</p>
          <h1 className="mt-gap-xs font-lv-display text-[28px] font-bold text-ink">{project.name}</h1>
          <p className="mt-gap-xs inline-flex items-center gap-1 text-small text-ink-soft/75"><MapPin size={15} /> {project.venueName}</p>
        </header>

        <div className="grid gap-gap-sm sm:grid-cols-3">
          <div className="rounded-2xl border border-ink/10 bg-white p-gap-md">
            <p className="text-meta text-ink-soft/65">Estado</p>
            <p className="mt-1 font-lv-display text-small font-semibold text-ink">{STATUS[project.status]}</p>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-white p-gap-md">
            <p className="text-meta text-ink-soft/65">Fechas</p>
            <p className="mt-1 inline-flex items-center gap-1 font-lv-display text-small font-semibold text-ink"><CalendarDays size={14} /> {project.startsAt} – {project.endsAt}</p>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-white p-gap-md">
            <p className="text-meta text-ink-soft/65">Fotos</p>
            <p className="mt-1 inline-flex items-center gap-1 font-lv-display text-small font-semibold text-ink"><ImageIcon size={14} /> {project.imageUrls.length} / 8</p>
          </div>
        </div>

        <section className="border-t border-ink/10 pt-gap-md">
          <h2 className="font-lv-display text-small font-semibold text-ink">Descripción</h2>
          <p className="mt-1 whitespace-pre-wrap text-small leading-relaxed text-ink-soft/80">{project.description}</p>
        </section>

        {project.status === "rejected" && project.adminNote && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-gap-md py-3 text-small text-red-700"><strong>Motivo:</strong> {project.adminNote}</p>
        )}

        <div className="flex flex-wrap gap-gap-sm">
          <button type="button" onClick={() => setView("editor")} className="inline-flex h-11 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 hover:bg-verde-300"><Pencil size={16} /> Editar datos y ubicación</button>
          <button type="button" onClick={() => setView("photos")} className="inline-flex h-11 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-ink hover:bg-sand"><ImageIcon size={16} /> Administrar fotos</button>
          <button type="button" onClick={() => setView("publication")} className="inline-flex h-11 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-ink hover:bg-sand"><BadgeCheck size={16} /> Ver publicación</button>
        </div>
      </section>
    );
  }

  return (
    <div className="project-panel flex min-h-dvh flex-col bg-sand font-lv text-ink">
      <header className="sticky top-0 z-40 flex h-header shrink-0 items-center gap-2 border-b border-ink/5 bg-sand-warm/90 px-3 backdrop-blur-[16px] sm:px-gap-md">
        <Link href="/home" aria-label="Volver al inicio" className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft/75 hover:bg-verde-50 hover:text-verde-600"><ArrowLeft size={18} /></Link>
        <div className="font-lv-display text-[18px] font-bold text-ink">La Verde <span className="font-medium text-verde-600">Proyectos</span></div>
        <div className="flex-1" />
        <UserMenu />
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-[240px] shrink-0 flex-col gap-1 border-r border-ink/5 bg-white px-gap-sm pt-gap-md lg:flex">
          {PANEL_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setView(id)} aria-current={view === id ? "page" : undefined} className={cn("flex h-11 items-center gap-gap-sm rounded-full px-gap-md text-left font-lv-display text-small font-medium transition-colors", view === id ? "bg-verde-50 font-semibold text-verde-700" : "text-ink-soft/75 hover:bg-sand")}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-gap-md px-gap-sm pb-dock-clear pt-gap-sm sm:px-gap-md sm:pt-gap-md lg:px-gap-xl lg:py-gap-xl lg:pb-gap-xl">
            {projects.length > 1 && (
              <label className="flex max-w-lg flex-col gap-1 font-lv-display text-meta font-semibold text-ink-soft/75">
                Proyecto activo
                <select value={selectedId ?? ""} onChange={(event) => setSelectedId(event.target.value)} className="h-11 rounded-xl border border-ink/10 bg-white px-3 text-small text-ink outline-none focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20">
                  {projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            )}
            {error && <p role="alert" className="rounded-xl bg-red-50 px-gap-md py-3 text-small font-medium text-red-700">{error}</p>}
            {loading ? (
              <div className="flex min-h-48 items-center justify-center gap-gap-xs text-small text-ink-soft/75"><Loader2 size={18} className="animate-spin" /> Cargando el panel...</div>
            ) : !project ? (
              <section className="flex min-h-64 flex-col items-center justify-center gap-gap-sm text-center">
                <Megaphone size={28} className="text-verde-600" />
                <h1 className="font-lv-display text-[24px] font-bold text-ink">Todavía no tienes proyectos</h1>
                <p className="max-w-md text-small text-ink-soft/75">Registra tu primer proyecto desde la sección «Tengo un negocio» de tu perfil.</p>
                <Link href="/profile?seccion=negocio" className="mt-2 inline-flex h-10 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 hover:bg-verde-300">Ir a Tengo un negocio</Link>
              </section>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div key={`${project.id}-${view}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: EASE }} className="flex flex-col">
                  {viewContent()}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>

      <MobileDock
        label="Secciones del panel de proyectos"
        items={PANEL_ITEMS.map((item) => ({
          key: item.id,
          label: item.short,
          icon: item.icon,
          active: view === item.id,
          onSelect: () => setView(item.id),
        }))}
      />
    </div>
  );
}