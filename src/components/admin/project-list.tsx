"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, MapPin, Megaphone, Pencil, RotateCcw, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Project {
  id: string;
  name: string;
  description: string;
  contact: string;
  phones: string[];
  socialLinks: string[];
  provinces: string[];
  venueName: string;
  lat: number;
  lng: number;
  startsAt: string;
  endsAt: string;
  offers: string | null;
  status: "approved";
  createdAt: string;
}

interface ProjectDraft {
  name: string;
  description: string;
  contact: string;
  phones: string;
  socialLinks: string;
  provinces: string;
  venueName: string;
  lat: string;
  lng: string;
  startsAt: string;
  endsAt: string;
  offers: string;
}

const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-small text-ink outline-none focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

function toDraft(project: Project): ProjectDraft {
  return {
    name: project.name,
    description: project.description,
    contact: project.contact,
    phones: project.phones.join(", "),
    socialLinks: project.socialLinks.join(", "),
    provinces: project.provinces.join(", "),
    venueName: project.venueName,
    lat: String(project.lat),
    lng: String(project.lng),
    startsAt: project.startsAt,
    endsAt: project.endsAt,
    offers: project.offers ?? "",
  };
}

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);
  const [draft, setDraft] = useState<ProjectDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/project-requests?status=approved");
      if (!response.ok) throw new Error("No se pudieron cargar los proyectos.");
      setProjects((await response.json()) as Project[]);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los proyectos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return projects;
    return projects.filter((project) =>
      `${project.name} ${project.venueName} ${project.provinces.join(" ")}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [projects, query]);

  function openEditor(project: Project) {
    setEditing(project);
    setDraft(toDraft(project));
  }

  function closeEditor() {
    if (workingId) return;
    setEditing(null);
    setDraft(null);
  }

  function setField<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !draft) return;
    setWorkingId(editing.id);
    setError(null);
    try {
      const response = await fetch(`/api/project-requests/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          phones: draft.phones.split(",").map((value) => value.trim()).filter(Boolean),
          socialLinks: draft.socialLinks.split(",").map((value) => value.trim()).filter(Boolean),
          provinces: draft.provinces.split(",").map((value) => value.trim()).filter(Boolean),
          lat: Number(draft.lat),
          lng: Number(draft.lng),
          offers: draft.offers.trim() || null,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo guardar el proyecto.");
      }
      const updated = (await response.json()) as Project;
      setProjects((current) => current.map((project) => project.id === updated.id ? updated : project));
      setEditing(null);
      setDraft(null);
      toast.success(`Se guardaron los cambios de «${updated.name}».`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el proyecto.");
    } finally {
      setWorkingId(null);
    }
  }

  async function returnToRequests(project: Project) {
    setWorkingId(project.id);
    try {
      const response = await fetch(`/api/project-requests/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      });
      if (!response.ok) throw new Error("No se pudo devolver el proyecto a solicitudes.");
      setProjects((current) => current.filter((item) => item.id !== project.id));
      toast.success(`«${project.name}» volvió a Solicitudes de proyectos.`);
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "No se pudo actualizar el proyecto.";
      setError(message);
      toast.error(message);
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-gap-lg">
      <header>
        <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">Catálogo</p>
        <h1 className="mt-gap-xs font-lv-display text-[clamp(28px,5vw,44px)] font-bold text-ink">Proyectos</h1>
        <p className="mt-gap-sm text-body text-ink-soft/75">Edita los proyectos aprobados o devuélvelos a revisión.</p>
      </header>

      <div className="flex flex-col gap-gap-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-ink-soft/75">{projects.length} proyectos aprobados</p>
        <div className="relative w-full sm:max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/70" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar proyectos..."
            aria-label="Buscar proyectos"
            className={`${INPUT} pl-9`}
          />
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-gap-md py-3 text-small font-medium text-red-700">{error}</p>}
      {loading ? (
        <div className="flex items-center gap-gap-xs text-small text-ink-soft/75"><Loader2 size={18} className="animate-spin" /> Cargando proyectos...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-ink/10 bg-white p-gap-lg text-small text-ink-soft/75">
          {query ? "No hay proyectos que coincidan con la búsqueda." : "Todavía no hay proyectos aprobados."}
        </div>
      ) : (
        <div className="grid gap-gap-md">
          {filtered.map((project) => (
            <article key={project.id} className="rounded-2xl border border-ink/10 bg-white p-gap-lg shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-gap-md">
                <div className="flex min-w-0 items-start gap-gap-sm">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-verde-50 text-verde-700"><Megaphone size={21} /></span>
                  <div className="min-w-0">
                    <h2 className="font-lv-display text-[21px] font-bold text-ink">{project.name}</h2>
                    <p className="text-meta text-ink-soft/70">Aprobado · {project.startsAt} a {project.endsAt}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-gap-xs">
                  <button type="button" onClick={() => openEditor(project)} className="inline-flex h-10 items-center gap-gap-xs rounded-full border border-ink/10 px-gap-md font-lv-display text-small font-semibold text-ink hover:bg-sand">
                    <Pencil size={15} /> Editar
                  </button>
                  <button type="button" disabled={workingId === project.id} onClick={() => void returnToRequests(project)} className="inline-flex h-10 items-center gap-gap-xs rounded-full border border-ink/10 px-gap-md font-lv-display text-small font-semibold text-ink-soft/75 hover:bg-sand disabled:opacity-50">
                    <RotateCcw size={15} /> Devolver a solicitudes
                  </button>
                </div>
              </div>
              <p className="mt-gap-md text-small leading-relaxed text-ink-soft/85">{project.description}</p>
              <div className="mt-gap-md grid gap-gap-sm border-t border-ink/10 pt-gap-md text-small text-ink-soft/80 sm:grid-cols-2">
                <p className="flex items-start gap-gap-xs"><MapPin size={16} className="mt-0.5 shrink-0 text-verde-600" /><span><strong className="text-ink">Lugar:</strong> {project.venueName}<br />{project.provinces.join(", ")} · {project.lat.toFixed(5)}, {project.lng.toFixed(5)}</span></p>
                <p><strong className="text-ink">Contacto:</strong> {project.contact} · {project.phones.join(", ")}</p>
                {project.offers && <p className="sm:col-span-2"><strong className="text-ink">Ofertas:</strong> {project.offers}</p>}
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) closeEditor(); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar proyecto</DialogTitle>
          </DialogHeader>
          {draft && (
            <form onSubmit={(event) => void saveProject(event)} className="flex flex-col gap-gap-sm">
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">Nombre<input required maxLength={160} className={INPUT} value={draft.name} onChange={(event) => setField("name", event.target.value)} /></label>
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">Descripción<textarea required rows={3} className={`${INPUT} h-auto py-3`} value={draft.description} onChange={(event) => setField("description", event.target.value)} /></label>
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">Persona de contacto<input required className={INPUT} value={draft.contact} onChange={(event) => setField("contact", event.target.value)} /></label>
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">Teléfonos (separados por coma)<input required className={INPUT} value={draft.phones} onChange={(event) => setField("phones", event.target.value)} /></label>
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">Redes sociales (separadas por coma)<input className={INPUT} value={draft.socialLinks} onChange={(event) => setField("socialLinks", event.target.value)} /></label>
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">Provincias (separadas por coma)<input required className={INPUT} value={draft.provinces} onChange={(event) => setField("provinces", event.target.value)} /></label>
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">Lugar<input required className={INPUT} value={draft.venueName} onChange={(event) => setField("venueName", event.target.value)} /></label>
              <div className="grid grid-cols-2 gap-gap-sm">
                <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">Latitud<input required type="number" step="any" className={INPUT} value={draft.lat} onChange={(event) => setField("lat", event.target.value)} /></label>
                <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">Longitud<input required type="number" step="any" className={INPUT} value={draft.lng} onChange={(event) => setField("lng", event.target.value)} /></label>
              </div>
              <div className="grid grid-cols-2 gap-gap-sm">
                <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">Inicio<input required type="date" className={INPUT} value={draft.startsAt} onChange={(event) => setField("startsAt", event.target.value)} /></label>
                <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">Finalización<input required type="date" className={INPUT} value={draft.endsAt} onChange={(event) => setField("endsAt", event.target.value)} /></label>
              </div>
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">Ofertas<textarea rows={3} className={`${INPUT} h-auto py-3`} value={draft.offers} onChange={(event) => setField("offers", event.target.value)} /></label>
              <DialogFooter className="gap-gap-xs sm:gap-gap-xs">
                <DialogClose asChild><button type="button" disabled={workingId !== null} className="inline-flex h-10 items-center gap-gap-xs rounded-full border border-ink/10 px-gap-md text-small font-semibold text-ink-soft/75"><X size={15} /> Cancelar</button></DialogClose>
                <button type="submit" disabled={workingId !== null} className="inline-flex h-10 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 disabled:opacity-50">
                  {workingId ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Guardar cambios
                </button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}