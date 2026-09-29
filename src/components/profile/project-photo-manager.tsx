"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, ImagePlus, Loader2, MapPin, Save, Star, Trash2 } from "lucide-react";
import { MAX_PROJECT_MEDIA } from "@/lib/storage/project-media";
import { prepareProjectImage } from "@/lib/storage/compress";
import type { ProjectFormProject } from "@/components/profile/project-registration-form";

type ImageRole = "cover" | "pin" | "gallery";
type PendingUpload = { id: string; file: File; role: ImageRole; previewUrl: string };

type ProjectImageResponse = Pick<
  ProjectFormProject,
  "coverImageUrl" | "mapImageUrl" | "imageUrls" | "status"
>;

function allImageUrls(project: ProjectFormProject): string[] {
  return [...new Set([project.coverImageUrl, project.mapImageUrl, ...project.imageUrls].filter((url): url is string => Boolean(url)))];
}

export function ProjectPhotoManager({
  project,
  onUpdated,
}: {
  project: ProjectFormProject;
  onUpdated: (patch: Partial<ProjectFormProject>) => void;
}) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<Partial<Record<"cover" | "pin", string>>>({});
  const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);
  const mediaCount = allImageUrls(project).length;
  const replacedSlotUrls = new Set([
    ...(pendingUploads.some((item) => item.role === "cover") && project.coverImageUrl && !project.imageUrls.includes(project.coverImageUrl) && project.coverImageUrl !== project.mapImageUrl ? [project.coverImageUrl] : []),
    ...(pendingUploads.some((item) => item.role === "pin") && project.mapImageUrl && !project.imageUrls.includes(project.mapImageUrl) && project.mapImageUrl !== project.coverImageUrl ? [project.mapImageUrl] : []),
  ]);
  const displayedMediaCount = allImageUrls(project).filter((url) => !pendingDeletes.includes(url) && !replacedSlotUrls.has(url)).length + pendingUploads.length;

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  function releasePreview(url: string) {
    URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(url);
  }

  function queueUploads(files: File[], role: ImageRole) {
    if (files.length === 0) return;
    const previousSlotImage = role === "cover" ? project.coverImageUrl : role === "pin" ? project.mapImageUrl : null;
    const otherSlotImage = role === "cover" ? project.mapImageUrl : project.coverImageUrl;
    const replacesUniqueSlot = Boolean(previousSlotImage && !pendingDeletes.includes(previousSlotImage) && !project.imageUrls.includes(previousSlotImage) && previousSlotImage !== otherSlotImage);
    const addedCount = role === "gallery" ? files.length : Math.max(0, files.length - (replacesUniqueSlot ? 1 : 0));
    const replacedUploads = role === "gallery" ? 0 : pendingUploads.filter((item) => item.role === role).length;
    const remainingCount = allImageUrls(project).filter((url) => !pendingDeletes.includes(url)).length;
    if (remainingCount + pendingUploads.length - replacedUploads + addedCount > MAX_PROJECT_MEDIA) {
      setError(`Cada proyecto admite hasta ${MAX_PROJECT_MEDIA} materiales visuales.`);
      return;
    }
    setError(null);
    const replacedDrafts = pendingUploads.filter((item) => role !== "gallery" && item.role === role);
    replacedDrafts.forEach((item) => releasePreview(item.previewUrl));
    const uploads = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      return { id: crypto.randomUUID(), file, role, previewUrl };
    });
    setPendingUploads((current) => [
      ...current.filter((item) => role === "gallery" || item.role !== role),
      ...uploads,
    ]);
    if (role !== "gallery") {
      setPendingAssignments((current) => {
        const next = { ...current };
        delete next[role];
        return next;
      });
    }
  }

  function discardPendingUpload(item: PendingUpload) {
    releasePreview(item.previewUrl);
    setPendingUploads((current) => current.filter(({ id }) => id !== item.id));
  }

  function changeUploadRole(item: PendingUpload, role: "cover" | "pin") {
    const replacedDrafts = pendingUploads.filter((candidate) => candidate.role === role && candidate.id !== item.id);
    replacedDrafts.forEach((candidate) => releasePreview(candidate.previewUrl));
    setPendingUploads((current) => current
      .filter((candidate) => !replacedDrafts.some((replaced) => replaced.id === candidate.id))
      .map((candidate) => candidate.id === item.id ? { ...candidate, role } : candidate));
    setPendingAssignments((current) => {
      const next = { ...current };
      delete next[role];
      return next;
    });
  }

  async function assignImage(imageUrl: string, role: "cover" | "pin") {
    setError(null);
    setPendingDeletes((current) => current.filter((url) => url !== imageUrl));
    setPendingAssignments((current) => ({ ...current, [role]: imageUrl }));
    const replacedDrafts = pendingUploads.filter((item) => item.role === role);
    replacedDrafts.forEach((item) => releasePreview(item.previewUrl));
    setPendingUploads((current) => current.filter((item) => item.role !== role));
  }

  function queueDelete(url: string) {
    setError(null);
    setPendingDeletes((current) => current.includes(url) ? current : [...current, url]);
    setPendingAssignments((current) => {
      const next = { ...current };
      if (next.cover === url) delete next.cover;
      if (next.pin === url) delete next.pin;
      return next;
    });
  }

  function restoreDelete(url: string) {
    setPendingDeletes((current) => current.filter((item) => item !== url));
  }

  async function saveChanges() {
    if (pendingUploads.length === 0 && Object.keys(pendingAssignments).length === 0 && pendingDeletes.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const imageUrl of pendingDeletes) {
        const response = await fetch(`/api/project-requests/${project.id}/images?imageUrl=${encodeURIComponent(imageUrl)}`, { method: "DELETE" });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "No se pudo eliminar la foto.");
        }
        const data = (await response.json()) as ProjectImageResponse;
        onUpdated({ ...data, adminNote: null });
        setPendingDeletes((current) => current.filter((url) => url !== imageUrl));
      }

      for (const role of ["cover", "pin"] as const) {
        const imageUrl = pendingAssignments[role];
        if (!imageUrl) continue;
        const response = await fetch(`/api/project-requests/${project.id}/images`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl, role }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "No se pudo asignar la foto.");
        }
        const data = (await response.json()) as ProjectImageResponse;
        onUpdated({ ...data, adminNote: null });
        setPendingAssignments((current) => {
          const next = { ...current };
          delete next[role];
          return next;
        });
      }

      for (const item of pendingUploads) {
        const prepared = await prepareProjectImage(item.file);
        const body = new FormData();
        body.append("file", prepared.blob, prepared.name);
        body.append("role", item.role);
        if (prepared.width) body.append("width", String(prepared.width));
        if (prepared.height) body.append("height", String(prepared.height));
        const response = await fetch(`/api/project-requests/${project.id}/images`, { method: "POST", body });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "No se pudo subir la foto.");
        }
        const data = (await response.json()) as ProjectImageResponse;
        onUpdated({ ...data, adminNote: null });
        releasePreview(item.previewUrl);
        setPendingUploads((current) => current.filter(({ id }) => id !== item.id));
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar los cambios de las fotos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-gap-md">
      <div>
        <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">Material visual</p>
        <h2 className="mt-gap-xs font-lv-display text-[24px] font-bold text-ink">Fotos del proyecto</h2>
        <p className="mt-gap-xs text-small text-ink-soft/75">Foto de portada, foto del pin y galería. Hasta {MAX_PROJECT_MEDIA} archivos; GIFs animados de máximo 2 MB.</p>
      </div>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          queueUploads(files.slice(0, 1), "cover");
        }}
      />
      <input
        ref={pinInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          queueUploads(files.slice(0, 1), "pin");
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          queueUploads(files, "gallery");
        }}
      />

      <div className="grid gap-gap-md sm:grid-cols-2">
        {([
          { role: "cover" as const, title: "Foto de portada", url: project.coverImageUrl, input: coverInputRef, icon: Star },
          { role: "pin" as const, title: "Foto del pin de ubicación", url: project.mapImageUrl, input: pinInputRef, icon: MapPin },
        ]).map(({ role, title, url, input, icon: Icon }) => {
          const pendingImage = pendingUploads.find((item) => item.role === role);
          const assignedUrl = pendingAssignments[role] ?? url;
          const savedPreviewUrl = assignedUrl && !pendingDeletes.includes(assignedUrl)
            ? assignedUrl
            : role === "pin" && !pendingAssignments.pin && project.coverImageUrl && !pendingDeletes.includes(project.coverImageUrl)
              ? project.coverImageUrl
              : null;
          const previewUrl = pendingImage?.previewUrl ?? savedPreviewUrl;
          const usesCover = role === "pin" && !assignedUrl && !pendingImage && Boolean(project.coverImageUrl);
          return (
            <section key={role} className="flex flex-col gap-gap-xs border-t border-ink/10 pt-gap-sm">
              <h3 className="font-lv-display text-small font-semibold text-ink">{title}</h3>
              <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-ink/10 bg-sand">
                {previewUrl ? (
                  <img src={previewUrl} alt={`${title} de ${project.name}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 text-ink-soft/65">
                    <Icon size={22} />
                    <span className="text-meta">Sin foto asignada</span>
                  </div>
                )}
                {usesCover && <span className="absolute bottom-2 left-2 rounded-full bg-ink/75 px-2 py-1 text-meta font-semibold text-white">Usa la foto de portada</span>}
              </div>
              <div className="flex flex-wrap gap-gap-xs">
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  disabled={busy}
                  className="inline-flex h-10 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 hover:bg-verde-300 disabled:opacity-60"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                  {previewUrl ? "Cambiar foto" : "Añadir foto"}
                </button>
                {pendingImage && (
                  <button type="button" onClick={() => discardPendingUpload(pendingImage)} disabled={busy} aria-label={`Descartar ${title.toLowerCase()}`} className="grid size-10 place-items-center rounded-full border border-ink/10 text-ink-soft hover:bg-red-50 hover:text-red-700 disabled:opacity-50">
                    <Trash2 size={15} />
                  </button>
                )}
                {url && !pendingImage && (
                  <button
                    type="button"
                    onClick={() => pendingDeletes.includes(url) ? restoreDelete(url) : queueDelete(url)}
                    disabled={busy}
                    aria-label={`${pendingDeletes.includes(url) ? "Restaurar" : "Quitar"} ${title.toLowerCase()}`}
                    className="grid size-10 place-items-center rounded-full border border-ink/10 text-ink-soft hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                  >
                    {pendingDeletes.includes(url) ? <ImagePlus size={15} /> : <Trash2 size={15} />}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="flex flex-col gap-gap-sm border-t border-ink/10 pt-gap-md">
        <div className="flex flex-wrap items-center justify-between gap-gap-sm">
          <div>
            <h3 className="font-lv-display text-small font-semibold text-ink">Galería y GIFs</h3>
            <p className="mt-1 text-meta text-ink-soft/75">{displayedMediaCount}/{MAX_PROJECT_MEDIA} archivos · Fotos optimizadas · GIF animado hasta 2 MB</p>
          </div>
          {displayedMediaCount < MAX_PROJECT_MEDIA && (
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={busy}
              className="inline-flex h-10 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-ink hover:bg-sand disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
              Añadir a la galería
            </button>
          )}
        </div>

        {project.imageUrls.length > 0 || pendingUploads.some((item) => item.role === "gallery") ? (
          <div className="grid grid-cols-2 gap-gap-sm sm:grid-cols-3 lg:grid-cols-4">
            {project.imageUrls.map((url, index) => {
              const isGif = url.toLowerCase().split("?")[0]?.endsWith(".gif") ?? false;
              const isPendingDelete = pendingDeletes.includes(url);
              return (
                <figure key={url} className={`relative flex aspect-square flex-col overflow-hidden rounded-xl border border-ink/10 bg-sand ${isPendingDelete ? "opacity-50" : ""}`}>
                  <img src={url} alt={`Material ${index + 1} de ${project.name}`} className="min-h-0 flex-1 object-cover" />
                  {isGif && <figcaption className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] font-semibold text-white">GIF</figcaption>}
                  {isPendingDelete && <figcaption className="absolute inset-x-0 top-0 bg-ink/75 px-2 py-1 text-center text-meta font-semibold text-white">Se quitará al guardar</figcaption>}
                  <div className="flex shrink-0 flex-wrap gap-1 border-t border-ink/10 bg-white p-1.5">
                    <button type="button" onClick={() => void assignImage(url, "cover")} disabled={busy || isGif || isPendingDelete} aria-pressed={pendingAssignments.cover === url} className={`flex-1 rounded-full px-2 py-1 text-[10px] font-semibold hover:bg-verde-50 hover:text-verde-700 disabled:opacity-40 ${pendingAssignments.cover === url ? "bg-verde-50 text-verde-700" : "text-ink-soft"}`}>Portada</button>
                    <button type="button" onClick={() => void assignImage(url, "pin")} disabled={busy || isGif || isPendingDelete} aria-pressed={pendingAssignments.pin === url} className={`flex-1 rounded-full px-2 py-1 text-[10px] font-semibold hover:bg-verde-50 hover:text-verde-700 disabled:opacity-40 ${pendingAssignments.pin === url ? "bg-verde-50 text-verde-700" : "text-ink-soft"}`}>Pin</button>
                    <button type="button" onClick={() => isPendingDelete ? restoreDelete(url) : queueDelete(url)} disabled={busy} aria-label={`${isPendingDelete ? "Restaurar" : "Eliminar"} material ${index + 1}`} className="grid size-7 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-red-50 hover:text-red-700 disabled:opacity-50">{isPendingDelete ? <ImagePlus size={13} /> : <Trash2 size={13} />}</button>
                  </div>
                </figure>
              );
            })}
            {pendingUploads.filter((item) => item.role === "gallery").map((item) => {
              const isGif = item.file.type === "image/gif" || item.file.name.toLowerCase().endsWith(".gif");
              return (
                <figure key={item.id} className="relative flex aspect-square flex-col overflow-hidden rounded-xl border border-ink/10 bg-sand">
                  <img src={item.previewUrl} alt={`Foto agregada: ${item.file.name}`} className="min-h-0 flex-1 object-cover" />
                  {isGif && <figcaption className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] font-semibold text-white">GIF</figcaption>}
                  <div className="flex shrink-0 flex-wrap gap-1 border-t border-ink/10 bg-white p-1.5">
                    <button type="button" onClick={() => changeUploadRole(item, "cover")} disabled={busy || isGif} className="flex-1 rounded-full px-2 py-1 text-[10px] font-semibold text-ink-soft hover:bg-verde-50 hover:text-verde-700 disabled:opacity-40">Portada</button>
                    <button type="button" onClick={() => changeUploadRole(item, "pin")} disabled={busy || isGif} className="flex-1 rounded-full px-2 py-1 text-[10px] font-semibold text-ink-soft hover:bg-verde-50 hover:text-verde-700 disabled:opacity-40">Pin</button>
                    <button type="button" onClick={() => discardPendingUpload(item)} disabled={busy} aria-label={`Quitar foto ${item.file.name}`} className="grid size-7 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><Trash2 size={13} /></button>
                  </div>
                </figure>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-28 flex-col items-center justify-center gap-gap-xs rounded-xl border border-dashed border-ink/15 bg-white text-center text-ink-soft/70">
            <ImageIcon size={22} />
            <p className="text-small">Aún no hay fotos adicionales.</p>
          </div>
        )}
      </section>

      {project.status === "approved" && (
        <p className="rounded-xl bg-sand px-gap-md py-3 text-meta text-ink-soft/75">
          Los cambios de fotos se guardan juntos y se actualizan en el mapa al confirmar.
        </p>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-gap-md py-3 text-small font-medium text-red-700">{error}</p>}
      {(pendingUploads.length > 0 || Object.keys(pendingAssignments).length > 0 || pendingDeletes.length > 0) && (
        <div className="flex justify-end border-t border-ink/10 pt-gap-md">
          <button
            type="button"
            onClick={() => void saveChanges()}
            disabled={busy}
            className="inline-flex h-11 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 hover:bg-verde-300 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {busy ? "Guardando cambios..." : "Guardar cambios"}
          </button>
        </div>
      )}
    </section>
  );
}