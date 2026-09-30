"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, AtSign, CalendarDays, ImagePlus, Loader2, MapPin, Plus, Send, Store, Tag, Trash2, X } from "lucide-react";
import { sanitizePhone } from "@/lib/utils";
import { FormSection, sectionMessage } from "@/components/business/form-section";
import { prepareProjectImage } from "@/lib/storage/compress";
import { MAX_PROJECT_MEDIA } from "@/lib/storage/project-media";
import { CUBA_PROVINCES } from "@/lib/user-preferences-store";
import { MapLocationPicker, type LocationPoint } from "@/components/map/MapLocationPicker";
import { focusProfileControl } from "@/components/profile/focus-profile-control";
import type { ProjectOfferPackage } from "@/lib/db/schema/project_requests";
import { ProjectOffersManager } from "@/components/profile/project-offers-manager";

export interface ProjectFormProject {
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
  offerPackages?: ProjectOfferPackage[];
  coverImageUrl: string | null;
  mapImageUrl: string | null;
  imageUrls: string[];
  adminNote: string | null;
  status: "pending" | "approved" | "rejected";
}

interface ProjectRegistrationFormProps {
  onBack: () => void;
  onSaved?: () => void;
  onUpdated?: (patch: Partial<ProjectFormProject>) => void;
  project?: ProjectFormProject;
  showPhotos?: boolean;
}

const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/60 outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/80";

/**
 * Hoy como `YYYY-MM-DD`, en el huso del navegador.
 *
 * `toISOString()` daría la fecha de UTC, que en Cuba ya es la de mañana a partir
 * de las 19:00: el mínimo del calendario saltaría un día y no dejaría elegir el
 * día en curso justo por la tarde.
 */
function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/* Los mismos topes que recorta la ruta (`text(body.name, 160)` y compañía). Sin
   ellos se escribe de más y el servidor guarda el texto cortado sin avisar. */
const MAX_NAME = 160;
const MAX_DESC = 2000;
const MAX_CONTACT = 200;
const MAX_VENUE = 200;

/**
 * Los títulos de las secciones, en un solo sitio.
 *
 * El de la sección no se usa para el acordeón —cada `FormSection` se abre
 * sola— sino para que el aviso de validación pueda decir **dónde** falta el
 * campo: con las secciones plegadas, un «Completa la descripción» a secas deja
 * al usuario buscando en seis cajas cerradas. Como el mismo nombre va en el
 * `title`, no hay dos listas que puedan discrepar.
 */
const SECTIONS = {
  datos: "Datos del proyecto",
  lugar: "Dónde se presenta",
  fechas: "Fechas",
  contacto: "Contacto",
  ofertas: "Ofertas y catálogo",
  fotos: "Fotos del proyecto",
} as const;

type SectionId = keyof typeof SECTIONS;

/** El aviso de abajo y las secciones que marca en rojo. Van juntos en un solo
    estado para que no puedan desincronizarse. */
type FormError = { message: string; sections: SectionId[] };

/**
 * Los archivos elegidos y todavía sin subir.
 *
 * Van aparte de las fotos ya guardadas —esas son miniaturas con su papelera—
 * porque la subida ocurre **después** de guardar: hasta entonces no hay nada en
 * la base que borrar, así que quitarlos aquí es solo sacarlos de la lista. Sin
 * esta lista, elegir un archivo equivocado obligaba a recargar y perder el resto
 * del formulario.
 */
function PendingFiles({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  if (files.length === 0) return null;
  return (
    <ul className="flex flex-col gap-gap-xs">
      {files.map((file, index) => (
        <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-gap-xs rounded-lg bg-sand px-3 py-2 text-meta text-ink-soft/80">
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Quitar ${file.name}`}
            className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white hover:text-red-600"
          >
            <X size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ProjectRegistrationForm({ onBack, onSaved, onUpdated, project, showPhotos = true }: ProjectRegistrationFormProps) {
  const [socialLinks, setSocialLinks] = useState(project?.socialLinks.length ? project.socialLinks : [""]);
  const [phoneNumbers, setPhoneNumbers] = useState(project?.phones.length ? project.phones : [""]);
  const [provinces, setProvinces] = useState(project?.provinces.length ? project.provinces : [""]);
  const [location, setLocation] = useState<LocationPoint | null>(project ? { lat: project.lat, lng: project.lng } : null);
  const [venueName, setVenueName] = useState(project?.venueName ?? "");
  const [startsAt, setStartsAt] = useState(project?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(project?.endsAt ?? "");
  /* Qué día es hoy se sabe tras montar, no antes: el servidor renderiza esto en
     su huso y el navegador en el del usuario, así que un `min` calculado en el
     render sale distinto en cada lado y React lo lee como desajuste de
     hidratación. */
  const [today, setToday] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState(project?.coverImageUrl ?? null);
  const [mapImageUrl, setMapImageUrl] = useState(project?.mapImageUrl ?? null);
  const [imageUrls, setImageUrls] = useState(project?.imageUrls ?? []);
  const [offerPackages, setOfferPackages] = useState(project?.offerPackages ?? []);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [selectedOfferFlyers, setSelectedOfferFlyers] = useState<File[]>([]);
  const [savedProjectId, setSavedProjectId] = useState(project?.id ?? null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const savedMediaCount = new Set([coverImageUrl, mapImageUrl, ...imageUrls].filter(Boolean)).size;

  useEffect(() => setToday(todayISO()), []);

  /* El suelo del calendario. En un alta nueva es hoy. Editando un proyecto que
     ya arrancó —o que ya terminó— se respeta la fecha que traía: con el mínimo
     en hoy, sus propias fechas quedarían fuera de rango y no habría forma de
     guardar el proyecto en marcha sin moverle las fechas. */
  const originalStart = project?.startsAt ?? "";
  const startMin =
    !originalStart || originalStart > today ? today : originalStart;
  const endMin = startsAt && startsAt > startMin ? startsAt : startMin;

  async function uploadProjectImage(projectId: string, file: File, role: "cover" | "pin" | "gallery") {
    const prepared = await prepareProjectImage(file);
    const imageForm = new FormData();
    imageForm.append("file", prepared.blob, prepared.name);
    imageForm.append("role", role);
    if (prepared.width) imageForm.append("width", String(prepared.width));
    if (prepared.height) imageForm.append("height", String(prepared.height));
    const imageResponse = await fetch(`/api/project-requests/${projectId}/images`, { method: "POST", body: imageForm });
    if (!imageResponse.ok) {
      const data = (await imageResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "No se pudo subir una foto.");
    }
    const result = (await imageResponse.json()) as ProjectFormProject;
    setCoverImageUrl(result.coverImageUrl);
    setMapImageUrl(result.mapImageUrl);
    setImageUrls(result.imageUrls);
  }

  function updateSocialLink(index: number, value: string) {
    setSocialLinks((current) => current.map((link, linkIndex) => (linkIndex === index ? value : link)));
  }

  function addSocialLink() {
    setSocialLinks((current) => [...current, ""]);
  }

  function removeSocialLink(index: number) {
    setSocialLinks((current) => current.length === 1 ? current : current.filter((_, linkIndex) => linkIndex !== index));
  }

  function updatePhone(index: number, value: string) {
    setPhoneNumbers((current) => current.map((phone, phoneIndex) => (phoneIndex === index ? value : phone)));
  }

  function updateProvince(index: number, value: string) {
    setProvinces((current) => current.map((province, provinceIndex) => (provinceIndex === index ? value : province)));
  }

  function openDatePicker(field: "startsAt" | "endsAt") {
    const input = document.querySelector<HTMLInputElement>(`input[name="${field}"]`);
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.focus({ preventScroll: true });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    /* Los campos que faltan, agrupados por sección: el aviso sale como
       «Dónde se presenta»: falta una provincia habitual, el nombre del lugar. */
    const missing = new Map<SectionId, string[]>();
    const add = (section: SectionId, text: string) =>
      missing.set(section, [...(missing.get(section) ?? []), text]);
    const needs = (value: string, section: SectionId, text: string) => {
      if (!value.trim()) add(section, text);
    };
    needs(String(formData.get("name") ?? ""), "datos", "el nombre del proyecto");
    needs(String(formData.get("description") ?? ""), "datos", "la descripción");
    needs(String(formData.get("contact") ?? ""), "contacto", "la persona de contacto");
    if (!phoneNumbers.some((phone) => phone.trim())) add("contacto", "un teléfono");
    if (!provinces.some(Boolean)) add("lugar", "una provincia habitual");
    needs(venueName, "lugar", "el nombre del lugar");
    if (!location) add("lugar", "el punto exacto en el mapa");
    needs(startsAt, "fechas", "la fecha de inicio");
    needs(endsAt, "fechas", "la fecha de finalización");

    if (missing.size > 0) {
      setError(
        sectionMessage(
          SECTIONS,
          [...missing].map(([section, fields]) => ({
            section,
            text: `falta ${fields.join(", ")}`,
          })),
        ),
      );
      return;
    }
    /* `min` en el calendario no basta: el formulario va con `noValidate`, así que
       el navegador no bloquea nada al enviar. Las reglas van aquí, que es lo
       único que corre. Comparar las dos como texto vale porque son `YYYY-MM-DD`,
       que ordena igual que la fecha. */
    if (startMin && startsAt < startMin) {
      setError(sectionMessage(SECTIONS, [{ section: "fechas", text: "la fecha de inicio no puede ser anterior a hoy" }]));
      return;
    }
    if (endsAt < startsAt) {
      setError(sectionMessage(SECTIONS, [{ section: "fechas", text: "la fecha de finalización no puede ser anterior a la de inicio" }]));
      return;
    }
    const selectedLocation = location;
    if (!selectedLocation) return;

    setSending(true);
    setError(null);
    const response = await fetch(savedProjectId ? `/api/project-requests/${savedProjectId}` : "/api/project-requests", {
      method: savedProjectId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        description: formData.get("description"),
        contact: formData.get("contact"),
        phones: phoneNumbers,
        socialLinks: socialLinks.filter(Boolean),
        provinces: provinces.filter(Boolean),
        venueName,
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        startsAt,
        endsAt,
        offers: formData.get("offers"),
        offerPackages,
        ...(location ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : {}),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setSending(false);
      const data = await response?.json().catch(() => null);
      setError({ message: data?.error ?? "No se pudo enviar el proyecto.", sections: [] });
      return;
    }

    const savedProject = (await response.json()) as { id: string; imageUrls?: string[] };
    const projectId = savedProjectId ?? savedProject.id;
    setSavedProjectId(projectId);
    try {
      for (const [index, file] of selectedPhotos.entries()) {
        const isGif = file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");
        const role = index === 0 && !coverImageUrl && !isGif ? "cover" : "gallery";
        await uploadProjectImage(projectId, file, role);
      }
      for (const file of selectedOfferFlyers) {
        await uploadProjectImage(projectId, file, "gallery");
      }
      setSelectedPhotos([]);
      setSelectedOfferFlyers([]);
      setSending(false);
      if (onSaved) onSaved();
      else setSubmitted(true);
    } catch (uploadError) {
      setSending(false);
      setError({
        message:
          uploadError instanceof Error
            ? `El proyecto quedó guardado, pero ${uploadError.message}`
            : "El proyecto quedó guardado, pero no se pudieron subir todas las fotos.",
        sections: [],
      });
    }
  }

  async function removePhoto(url: string) {
    if (!savedProjectId) return;
    setError(null);
    const response = await fetch(`/api/project-requests/${savedProjectId}/images?imageUrl=${encodeURIComponent(url)}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError({
        message: data?.error ?? "No se pudo eliminar la foto.",
        sections: ["fotos"],
      });
      return;
    }
    const data = (await response.json()) as ProjectFormProject;
    setCoverImageUrl(data.coverImageUrl);
    setMapImageUrl(data.mapImageUrl);
    setImageUrls(data.imageUrls);
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-gap-sm inline-flex items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-700"
      >
        <ArrowLeft size={16} />
        {project ? "Volver a mis proyectos" : "Volver a opciones"}
      </button>

      <form lang="es-CU" noValidate onSubmit={handleSubmit} onPointerDownCapture={focusProfileControl} className="flex flex-col gap-gap-lg rounded-[24px] border border-ink/10 bg-white p-gap-lg shadow-[0_18px_50px_-32px_rgba(20,42,30,0.55)]">
        <div>
          <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">
            {project ? "Editar proyecto" : "Nuevo proyecto"}
          </p>
          <h2 className="mt-gap-xs font-lv-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {project ? "Administra tu proyecto" : "Registra tu proyecto"}
          </h2>
          <p className="mt-gap-sm text-body leading-relaxed text-ink-soft/80">
            {project
              ? "Actualiza los datos, la ubicación y las fotos del proyecto. Los cambios volverán a revisión."
              : "Cuéntanos qué haces, dónde te presentarás y cómo puede encontrarte la comunidad."}
          </p>
        </div>

        <FormSection title={SECTIONS.datos} invalid={error?.sections.includes("datos")} icon={<Store size={18} strokeWidth={1.8} />}>
          <div className="grid gap-gap-md sm:grid-cols-2">
            <label className="flex flex-col gap-gap-xs sm:col-span-2">
              <span className={LABEL}>Nombre del proyecto</span>
              <input className={INPUT} name="name" maxLength={MAX_NAME} defaultValue={project?.name} placeholder="Ej. Sonidos de La Habana" required />
            </label>
            <label className="flex flex-col gap-gap-xs sm:col-span-2">
              <span className={LABEL}>Descripción</span>
              <textarea
                className="min-h-28 w-full resize-y rounded-xl border border-ink/10 bg-white px-4 py-3 text-body text-ink placeholder:text-ink-soft/60 outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20"
                name="description"
                maxLength={MAX_DESC}
                defaultValue={project?.description}
                placeholder="Describe la propuesta, sus integrantes y qué experiencia ofreces."
                required
              />
            </label>
          </div>
        </FormSection>

        <FormSection title={SECTIONS.lugar} invalid={error?.sections.includes("lugar")} icon={<MapPin size={18} strokeWidth={1.8} />}>
          <div className="flex flex-col gap-gap-xs sm:col-span-2">
            <span className={LABEL}>Provincias habituales</span>
            {provinces.map((province, index) => (
              <div key={index} className="flex items-center gap-gap-xs">
                <span className="relative flex-1">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/60" size={17} />
                  <select className={`${INPUT} pl-10`} name="provinces" value={province} onChange={(event) => updateProvince(index, event.target.value)} required={index === 0}>
                    <option value="">Selecciona una provincia</option>
                    {CUBA_PROVINCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </span>
                <button type="button" onClick={() => setProvinces((current) => current.length === 1 ? current : current.filter((_, provinceIndex) => provinceIndex !== index))} disabled={provinces.length === 1} aria-label={`Eliminar provincia ${index + 1}`} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-soft/70 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30">
                  <X size={17} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setProvinces((current) => [...current, ""])} className="inline-flex w-fit items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-700 hover:text-verde-500">
              <Plus size={16} /> Agregar otra provincia
            </button>
            <div className="mt-gap-sm flex flex-col gap-gap-xs">
              <span className={LABEL}>Lugar exacto de la actividad</span>
              <p className="text-meta leading-relaxed text-ink-soft/70">
                El lugar puede ser nuevo y no estar registrado todavía. Escribe su nombre y marca el punto exacto en el mapa.
              </p>
              <label className="mt-gap-xs flex flex-col gap-gap-xs">
                <span className={LABEL}>Nombre del lugar</span>
                <input
                  className={INPUT}
                  name="venueName"
                  maxLength={MAX_VENUE}
                  value={venueName}
                  onChange={(event) => setVenueName(event.target.value)}
                  placeholder="Ej. Hotel Meliá Varadero o Parque Central"
                  required
                />
              </label>
              <MapLocationPicker value={location} onChange={setLocation} />
              <p className="text-meta leading-relaxed text-ink-soft/70">
                Si no aparece en la búsqueda, toca directamente el mapa. Guardaremos el nombre que escribiste y esas coordenadas.
              </p>
            </div>
          </div>
        </FormSection>

        <FormSection title={SECTIONS.fechas} invalid={error?.sections.includes("fechas")} icon={<CalendarDays size={18} strokeWidth={1.8} />}>
          <div className="grid gap-gap-md sm:grid-cols-2">
            <label className="flex flex-col gap-gap-xs">
              <span className={LABEL}>Fecha de inicio</span>
              <span className="flex items-center gap-gap-xs">
                <input className={`${INPUT} project-date-input`} lang="es-CU" type="date" name="startsAt" min={startMin || undefined} value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
                <button type="button" onClick={() => openDatePicker("startsAt")} aria-label="Seleccionar fecha de inicio" className="grid size-11 shrink-0 place-items-center rounded-xl border border-ink/10 bg-white text-verde-700 transition-colors hover:border-verde-300 hover:bg-verde-50">
                  <CalendarDays size={18} />
                </button>
              </span>
              <span className="text-meta text-ink-soft/70">Hoy o más adelante.</span>
            </label>
            <label className="flex flex-col gap-gap-xs">
              <span className={LABEL}>Fecha de finalización</span>
              <span className="flex items-center gap-gap-xs">
                <input className={`${INPUT} project-date-input`} lang="es-CU" type="date" name="endsAt" min={endMin || undefined} value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required />
                <button type="button" onClick={() => openDatePicker("endsAt")} aria-label="Seleccionar fecha de finalización" className="grid size-11 shrink-0 place-items-center rounded-xl border border-ink/10 bg-white text-verde-700 transition-colors hover:border-verde-300 hover:bg-verde-50">
                  <CalendarDays size={18} />
                </button>
              </span>
              <span className="text-meta text-ink-soft/70">El día del inicio o después.</span>
            </label>
          </div>
        </FormSection>

        <FormSection title={SECTIONS.contacto} invalid={error?.sections.includes("contacto")} icon={<AtSign size={18} strokeWidth={1.8} />}>
          <div className="grid gap-gap-md sm:grid-cols-2">
            <label className="flex flex-col gap-gap-xs">
              <span className={LABEL}>Persona de contacto</span>
              <input className={INPUT} name="contact" maxLength={MAX_CONTACT} defaultValue={project?.contact} placeholder="Nombre de la persona o grupo" required />
            </label>
            <div className="flex flex-col gap-gap-xs">
              <span className={LABEL}>Números de teléfono</span>
              {phoneNumbers.map((phone, index) => (
                <div key={index} className="flex items-center gap-gap-xs">
                  <input
                    className={INPUT}
                    name="phones"
                    type="tel"
                    value={phone}
                    onChange={(event) => updatePhone(index, sanitizePhone(event.target.value))}
                    placeholder={index === 0 ? "+53 5 123 4567" : "Otro número de teléfono"}
                    required={index === 0}
                  />
                  <button type="button" onClick={() => setPhoneNumbers((current) => current.length === 1 ? current : current.filter((_, phoneIndex) => phoneIndex !== index))} disabled={phoneNumbers.length === 1} aria-label={`Eliminar teléfono ${index + 1}`} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-soft/70 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30">
                    <X size={17} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setPhoneNumbers((current) => [...current, ""])} className="inline-flex w-fit items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-700 hover:text-verde-500">
                <Plus size={16} /> Agregar otro teléfono
              </button>
            </div>
            <div className="flex flex-col gap-gap-xs sm:col-span-2">
              <span className={LABEL}>Redes sociales</span>
              <div className="flex flex-col gap-gap-xs">
                {socialLinks.map((link, index) => (
                  <div key={index} className="flex items-center gap-gap-xs">
                    <input
                      className={INPUT}
                      name="socials"
                      type="url"
                      inputMode="url"
                      value={link}
                      onChange={(event) => updateSocialLink(index, event.target.value)}
                      placeholder={index === 0 ? "Instagram, Facebook o enlace" : "Otro enlace de red social"}
                    />
                    <button
                      type="button"
                      onClick={() => removeSocialLink(index)}
                      disabled={socialLinks.length === 1}
                      aria-label={`Eliminar enlace ${index + 1}`}
                      className="grid size-10 shrink-0 place-items-center rounded-full text-ink-soft/70 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <X size={17} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addSocialLink}
                className="mt-[2px] inline-flex w-fit items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-700 transition-colors hover:text-verde-500"
              >
                <Plus size={16} />
                Agregar otra red social
              </button>
            </div>
          </div>
        </FormSection>

        <FormSection title={SECTIONS.ofertas} invalid={error?.sections.includes("ofertas")} icon={<Tag size={18} strokeWidth={1.8} />}>
          <div className="flex flex-col gap-gap-sm">
            {project && (
              <ProjectOffersManager
                project={{ ...project, offerPackages }}
                onUpdated={(patch) => {
                  if (patch.offerPackages) setOfferPackages(patch.offerPackages);
                  onUpdated?.(patch);
                }}
              />
            )}
            <details className="rounded-xl border border-ink/10 bg-white px-gap-md py-gap-sm">
              <summary className="cursor-pointer font-lv-display text-meta font-semibold text-ink-soft/80">Texto anterior de ofertas o catálogo (opcional)</summary>
              <textarea
                className="mt-gap-sm min-h-24 w-full resize-y rounded-xl border border-ink/10 bg-white px-4 py-3 text-body text-ink placeholder:text-ink-soft/60 outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20"
                name="offers"
                defaultValue={project?.offers ?? ""}
                placeholder="Información general anterior sobre servicios, promociones o productos"
              />
            </details>
            <label className="flex min-h-20 cursor-pointer items-center gap-gap-sm rounded-xl border border-dashed border-ink/15 bg-sand px-4 py-3 text-ink-soft/75 transition-colors hover:border-verde-300 hover:bg-verde-50">
              <ImagePlus size={20} className="shrink-0 text-verde-600" />
              <span className="flex flex-1 flex-col gap-1">
                <span className="font-lv-display text-small font-semibold text-ink">Añadir flyer de ofertas o catálogo</span>
                <span className="text-meta">Imagen de promociones, menú o productos · {savedMediaCount + selectedPhotos.length + selectedOfferFlyers.length}/{MAX_PROJECT_MEDIA} archivos · GIF hasta 2 MB</span>
              </span>
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (savedMediaCount + selectedPhotos.length + selectedOfferFlyers.length + files.length > MAX_PROJECT_MEDIA) {
                    setError({
                      message: `Cada proyecto admite hasta ${MAX_PROJECT_MEDIA} materiales visuales.`,
                      sections: ["ofertas"],
                    });
                    return;
                  }
                  setSelectedOfferFlyers((current) => [...current, ...files]);
                  setError(null);
                }}
              />
            </label>
            <PendingFiles files={selectedOfferFlyers} onRemove={(index) => setSelectedOfferFlyers((current) => current.filter((_, fileIndex) => fileIndex !== index))} />
          </div>
        </FormSection>

        {showPhotos && (
          <FormSection title={SECTIONS.fotos} invalid={error?.sections.includes("fotos")} icon={<ImagePlus size={18} strokeWidth={1.8} />}>
            <div className="flex flex-col gap-gap-sm">
              {(coverImageUrl || imageUrls.length > 0) && (
                <div className="grid grid-cols-3 gap-gap-xs">
                  {[...new Set([coverImageUrl, ...imageUrls].filter((url): url is string => Boolean(url)))].map((url, index) => (
                    <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-ink/10 bg-sand">
                      <img src={url} alt={`Foto ${index + 1} de ${project?.name ?? "tu proyecto"}`} className="h-full w-full object-cover" />
                      <button type="button" onClick={() => void removePhoto(url)} aria-label={`Eliminar foto ${index + 1}`} className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-ink/75 text-white hover:bg-red-700">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-gap-xs rounded-xl border border-dashed border-ink/15 bg-sand px-4 text-center text-ink-soft/75 transition-colors hover:border-verde-300 hover:bg-verde-50">
                <ImagePlus size={22} className="text-verde-600" />
                <span className="font-lv-display text-small font-semibold text-ink">Añadir fotos del proyecto</span>
                <span className="text-meta">{savedMediaCount + selectedPhotos.length + selectedOfferFlyers.length}/{MAX_PROJECT_MEDIA} · La primera foto será la principal</span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    const next = [...selectedPhotos, ...files];
                    if (savedMediaCount + next.length + selectedOfferFlyers.length > MAX_PROJECT_MEDIA) {
                      setError({
                        message: `Cada proyecto admite hasta ${MAX_PROJECT_MEDIA} materiales visuales.`,
                        sections: ["fotos"],
                      });
                      return;
                    }
                    setSelectedPhotos(next);
                    setError(null);
                  }}
                />
              </label>
              <PendingFiles files={selectedPhotos} onRemove={(index) => setSelectedPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} />
            </div>
          </FormSection>
        )}

        <div className="flex flex-wrap items-center justify-between gap-gap-sm border-t border-ink/10 pt-gap-md">
          {error && <p role="alert" className="w-full rounded-xl bg-destructive/10 px-gap-sm py-2 text-meta font-medium text-destructive">{error.message}</p>}
          {submitted && <p className="w-full rounded-xl bg-verde-50 px-gap-sm py-2 text-meta font-medium text-verde-700">Proyecto guardado. Quedó pendiente de revisión.</p>}
          <p className="max-w-[440px] text-meta leading-relaxed text-ink-soft/70">
            El proyecto será revisado antes de publicarse en el mapa y aparecer en las recomendaciones.
          </p>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] transition-colors hover:bg-verde-300"
          >
            <Send size={16} />
            {sending ? "Guardando..." : submitted ? "Proyecto guardado" : project ? "Guardar cambios" : "Enviar proyecto"}
          </button>
        </div>
      </form>
    </div>
  );
}
