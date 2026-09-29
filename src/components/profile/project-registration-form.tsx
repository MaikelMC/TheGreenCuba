"use client";

import { useState } from "react";
import { ArrowLeft, CalendarDays, ImagePlus, MapPin, Plus, Send, X } from "lucide-react";
import { CUBA_PROVINCES } from "@/lib/user-preferences-store";
import { MapLocationPicker, type LocationPoint } from "@/components/map/MapLocationPicker";
import { focusProfileControl } from "@/components/profile/focus-profile-control";

interface ProjectRegistrationFormProps {
  onBack: () => void;
}

const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/60 outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/80";

export function ProjectRegistrationForm({ onBack }: ProjectRegistrationFormProps) {
  const [socialLinks, setSocialLinks] = useState([""]);
  const [phoneNumbers, setPhoneNumbers] = useState([""]);
  const [provinces, setProvinces] = useState([""]);
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [venueName, setVenueName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

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
    input?.showPicker?.();
    input?.focus();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const missing: string[] = [];
    if (!String(formData.get("name") ?? "").trim()) missing.push("el nombre del proyecto");
    if (!String(formData.get("description") ?? "").trim()) missing.push("la descripción");
    if (!String(formData.get("contact") ?? "").trim()) missing.push("la persona de contacto");
    if (!phoneNumbers.some((phone) => phone.trim())) missing.push("un teléfono");
    if (!provinces.some(Boolean)) missing.push("una provincia habitual");
    if (!venueName.trim()) missing.push("el nombre del lugar");
    if (!location) missing.push("el punto exacto en el mapa");
    if (!String(formData.get("startsAt") ?? "")) missing.push("la fecha de inicio");
    if (!String(formData.get("endsAt") ?? "")) missing.push("la fecha de finalización");

    if (missing.length > 0) {
      setError(`Completa ${missing.join(", ")}.`);
      return;
    }
    const selectedLocation = location;
    if (!selectedLocation) return;

    setSending(true);
    setError(null);
    const response = await fetch("/api/project-requests", {
      method: "POST",
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
        startsAt: formData.get("startsAt"),
        endsAt: formData.get("endsAt"),
        offers: formData.get("offers"),
      }),
    }).catch(() => null);

    setSending(false);
    if (!response?.ok) {
      const data = await response?.json().catch(() => null);
      setError(data?.error ?? "No se pudo enviar el proyecto.");
      return;
    }
    setSubmitted(true);
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-gap-sm inline-flex items-center gap-gap-xs font-lv-display text-small font-semibold text-verde-700"
      >
        <ArrowLeft size={16} />
        Volver a opciones
      </button>

      <form lang="es-CU" noValidate onSubmit={handleSubmit} onPointerDownCapture={focusProfileControl} className="flex flex-col gap-gap-lg rounded-[24px] border border-ink/10 bg-white p-gap-lg shadow-[0_18px_50px_-32px_rgba(20,42,30,0.55)]">
        <div>
          <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">
            Nuevo proyecto
          </p>
          <h2 className="mt-gap-xs font-lv-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Registra tu proyecto
          </h2>
          <p className="mt-gap-sm text-body leading-relaxed text-ink-soft/80">
            Cuéntanos qué haces, dónde te presentarás y cómo puede encontrarte la comunidad.
          </p>
        </div>

        <div className="grid gap-gap-md sm:grid-cols-2">
          <label className="flex flex-col gap-gap-xs sm:col-span-2">
            <span className={LABEL}>Nombre del proyecto</span>
            <input className={INPUT} name="name" placeholder="Ej. Sonidos de La Habana" required />
          </label>
          <label className="flex flex-col gap-gap-xs sm:col-span-2">
            <span className={LABEL}>Descripción</span>
            <textarea
              className="min-h-28 w-full resize-y rounded-xl border border-ink/10 bg-white px-4 py-3 text-body text-ink placeholder:text-ink-soft/60 outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20"
              name="description"
              placeholder="Describe la propuesta, sus integrantes y qué experiencia ofreces."
              required
            />
          </label>
          <label className="flex flex-col gap-gap-xs">
            <span className={LABEL}>Persona de contacto</span>
            <input className={INPUT} name="contact" placeholder="Nombre de la persona o grupo" required />
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
                  onChange={(event) => updatePhone(index, event.target.value)}
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
          <label className="flex flex-col gap-gap-xs">
            <span className={LABEL}>Fecha de inicio</span>
            <span className="flex items-center gap-gap-xs">
              <input className={`${INPUT} project-date-input`} lang="es-CU" type="date" name="startsAt" required />
              <button type="button" onClick={() => openDatePicker("startsAt")} aria-label="Seleccionar fecha de inicio" className="grid size-11 shrink-0 place-items-center rounded-xl border border-ink/10 bg-white text-verde-700 transition-colors hover:border-verde-300 hover:bg-verde-50">
                <CalendarDays size={18} />
              </button>
            </span>
          </label>
          <label className="flex flex-col gap-gap-xs">
            <span className={LABEL}>Fecha de finalización</span>
            <span className="flex items-center gap-gap-xs">
              <input className={`${INPUT} project-date-input`} lang="es-CU" type="date" name="endsAt" required />
              <button type="button" onClick={() => openDatePicker("endsAt")} aria-label="Seleccionar fecha de finalización" className="grid size-11 shrink-0 place-items-center rounded-xl border border-ink/10 bg-white text-verde-700 transition-colors hover:border-verde-300 hover:bg-verde-50">
                <CalendarDays size={18} />
              </button>
            </span>
          </label>
          <label className="flex flex-col gap-gap-xs sm:col-span-2">
            <span className={LABEL}>Ofertas y catálogo de productos</span>
            <textarea
              className="min-h-24 w-full resize-y rounded-xl border border-ink/10 bg-white px-4 py-3 text-body text-ink placeholder:text-ink-soft/60 outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20"
              name="offers"
              placeholder="Entradas, servicios, promociones, productos o catálogo"
            />
          </label>
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-gap-xs rounded-xl border border-dashed border-ink/15 bg-sand px-4 text-center text-ink-soft/75 transition-colors hover:border-verde-300 hover:bg-verde-50 sm:col-span-2">
            <ImagePlus size={22} className="text-verde-600" />
            <span className="font-lv-display text-small font-semibold text-ink">Añadir imagen del proyecto</span>
            <span className="text-meta">Logo, cartel o foto de presentación</span>
            <input className="sr-only" type="file" accept="image/*" name="image" />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-gap-sm border-t border-ink/10 pt-gap-md">
          {error && <p className="w-full rounded-xl bg-red-50 px-gap-sm py-2 text-meta font-medium text-red-700">{error}</p>}
          {submitted && <p className="w-full rounded-xl bg-verde-50 px-gap-sm py-2 text-meta font-medium text-verde-700">Proyecto enviado. Quedó pendiente de revisión.</p>}
          <p className="max-w-[440px] text-meta leading-relaxed text-ink-soft/70">
            El proyecto será revisado antes de publicarse en el mapa y aparecer en las recomendaciones.
          </p>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] transition-colors hover:bg-verde-300"
          >
            <Send size={16} />
            {sending ? "Enviando..." : submitted ? "Proyecto enviado" : "Enviar proyecto"}
          </button>
        </div>
      </form>
    </div>
  );
}
