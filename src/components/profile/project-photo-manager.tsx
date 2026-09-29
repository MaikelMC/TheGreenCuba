"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { prepareImage } from "@/lib/storage/compress";
import type { ProjectFormProject } from "@/components/profile/project-registration-form";

const MAX_PROJECT_PHOTOS = 8;

export function ProjectPhotoManager({
  project,
  onUpdated,
}: {
  project: ProjectFormProject;
  onUpdated: (patch: Pick<ProjectFormProject, "imageUrls" | "status" | "adminNote">) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: File[]) {
    if (files.length === 0) return;
    if (project.imageUrls.length + files.length > MAX_PROJECT_PHOTOS) {
      setError(`Cada proyecto admite hasta ${MAX_PROJECT_PHOTOS} fotos.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      for (const file of files) {
        const prepared = await prepareImage(file);
        const body = new FormData();
        body.append("file", prepared.blob, prepared.name);
        if (prepared.width) body.append("width", String(prepared.width));
        if (prepared.height) body.append("height", String(prepared.height));

        const response = await fetch(`/api/project-requests/${project.id}/images`, {
          method: "POST",
          body,
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "No se pudo subir la foto.");
        }
        const data = (await response.json()) as {
          imageUrls: string[];
          status: ProjectFormProject["status"];
        };
        onUpdated({ imageUrls: data.imageUrls, status: data.status, adminNote: null });
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudieron subir las fotos.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(url: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/project-requests/${project.id}/images?imageUrl=${encodeURIComponent(url)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo eliminar la foto.");
      }
      const data = (await response.json()) as {
        imageUrls: string[];
        status: ProjectFormProject["status"];
      };
      onUpdated({ imageUrls: data.imageUrls, status: data.status, adminNote: null });
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "No se pudo eliminar la foto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-gap-md">
      <div>
        <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">Material visual</p>
        <h2 className="mt-gap-xs font-lv-display text-[24px] font-bold text-ink">Fotos del proyecto</h2>
        <p className="mt-gap-xs text-small text-ink-soft/75">Hasta {MAX_PROJECT_PHOTOS} fotos. Las imágenes se optimizan antes de subirlas.</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void upload(files);
        }}
      />

      {project.imageUrls.length > 0 ? (
        <div className="grid grid-cols-2 gap-gap-sm sm:grid-cols-3 lg:grid-cols-4">
          {project.imageUrls.map((url, index) => (
            <figure key={url} className="relative aspect-square overflow-hidden rounded-2xl border border-ink/10 bg-sand">
              <img src={url} alt={`Foto ${index + 1} de ${project.name}`} className="h-full w-full object-cover" />
              {index === 0 && <figcaption className="absolute bottom-2 left-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] font-semibold text-white">Portada</figcaption>}
              <button
                type="button"
                onClick={() => void remove(url)}
                disabled={busy}
                aria-label={`Eliminar foto ${index + 1}`}
                className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-ink/75 text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </figure>
          ))}
        </div>
      ) : (
        <div className="flex min-h-36 flex-col items-center justify-center gap-gap-xs rounded-2xl border border-dashed border-ink/15 bg-white text-center text-ink-soft/70">
          <ImageIcon size={24} />
          <p className="text-small">Este proyecto todavía no tiene fotos.</p>
        </div>
      )}

      {project.imageUrls.length < MAX_PROJECT_PHOTOS && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex h-11 w-fit items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 hover:bg-verde-300 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {busy ? "Guardando fotos..." : "Añadir fotos"}
        </button>
      )}

      {project.status === "approved" && (
        <p className="rounded-xl bg-sand px-gap-md py-3 text-meta text-ink-soft/75">
          Al cambiar las fotos, el proyecto vuelve a revisión antes de actualizarse en el mapa.
        </p>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-gap-md py-3 text-small font-medium text-red-700">{error}</p>}
    </section>
  );
}