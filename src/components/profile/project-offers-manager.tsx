"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { ProjectFormProject } from "@/components/profile/project-registration-form";
import type { ProjectOfferPackage } from "@/lib/db/schema/project_requests";

const MAX_PACKAGES = 20;
const INPUT = "h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-small text-ink placeholder:text-ink-soft/60 outline-none focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";
const TEXTAREA = "w-full resize-y rounded-xl border border-ink/10 bg-white px-3 py-2 text-small text-ink placeholder:text-ink-soft/60 outline-none focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

function normalizeOffers(offers: ProjectOfferPackage[] | undefined): ProjectOfferPackage[] {
  return (offers ?? []).map((offer) => ({
    ...offer,
    capacity: offer.capacity ?? null,
    includes: offer.includes ?? [],
  }));
}

export function ProjectOffersManager({
  project,
  onUpdated,
}: {
  project: ProjectFormProject;
  onUpdated: (patch: Partial<ProjectFormProject>) => void;
}) {
  const [offers, setOffers] = useState(() => normalizeOffers(project.offerPackages));
  const [savedOffers, setSavedOffers] = useState(() => normalizeOffers(project.offerPackages));
  const [expandedOffers, setExpandedOffers] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [savingOfferId, setSavingOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasChanges = JSON.stringify(offers) !== JSON.stringify(savedOffers);
  const hasUnnamedOffer = offers.some((offer) => !offer.title.trim());

  function updateOffer(index: number, patch: Partial<ProjectOfferPackage>) {
    setOffers((current) => current.map((offer, offerIndex) => offerIndex === index ? { ...offer, ...patch } : offer));
  }

  function toggleOffer(id: string) {
    setExpandedOffers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addOffer() {
    setOffers((current) => current.length >= MAX_PACKAGES ? current : [...current, {
      id: crypto.randomUUID(),
      title: "",
      price: "",
      includes: [],
      capacity: null,
      conditions: "",
      validUntil: "",
    }]);
  }

  function moveOffer(index: number, direction: -1 | 1) {
    setOffers((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function isOfferSaved(offer: ProjectOfferPackage) {
    const normalized = normalizeOffers([offer])[0];
    return savedOffers.some((saved) => JSON.stringify(saved) === JSON.stringify(normalized));
  }

  async function saveOffer(offer: ProjectOfferPackage) {
    if (!offer.title.trim() || saving || isOfferSaved(offer)) return;
    setSaving(true);
    setSavingOfferId(offer.id);
    setError(null);

    const normalizedOffer: ProjectOfferPackage = {
      ...offer,
      title: offer.title.trim(),
      price: offer.price.trim(),
      includes: offer.includes.map((item) => item.trim()).filter(Boolean),
      capacity: offer.capacity ?? null,
      conditions: offer.conditions.trim(),
      validUntil: offer.validUntil.trim(),
    };
    const savedById = new Map(savedOffers.map((saved) => [saved.id, saved]));
    savedById.set(normalizedOffer.id, normalizedOffer);
    const draftIds = new Set(offers.map((item) => item.id));
    const nextSavedOffers = [
      ...offers.flatMap((item) => {
        const saved = savedById.get(item.id);
        return saved ? [saved] : [];
      }),
      ...savedOffers.filter((saved) => !draftIds.has(saved.id)),
    ];

    try {
      const response = await fetch(`/api/project-requests/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerPackages: nextSavedOffers }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo guardar esta oferta.");
      }
      const updated = (await response.json()) as ProjectFormProject;
      const persisted = normalizeOffers(updated.offerPackages);
      setSavedOffers(persisted);
      onUpdated({
        offerPackages: persisted,
        status: updated.status,
        adminNote: updated.adminNote,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar esta oferta.");
    } finally {
      setSaving(false);
      setSavingOfferId(null);
    }
  }

  async function saveOffers() {
    if (!hasChanges || hasUnnamedOffer || saving) return;
    setSaving(true);
    setError(null);
    const nextOffers = normalizeOffers(offers);
    try {
      const response = await fetch(`/api/project-requests/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerPackages: nextOffers }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudieron guardar las ofertas.");
      }
      const updated = (await response.json()) as ProjectFormProject;
      const saved = normalizeOffers(updated.offerPackages);
      setOffers(saved);
      setSavedOffers(saved);
      onUpdated({
        offerPackages: saved,
        status: updated.status,
        adminNote: updated.adminNote,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar las ofertas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-gap-md">
      <header>
        <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">Paquetes del proyecto</p>
        <h1 className="mt-gap-xs font-lv-display text-[24px] font-bold text-ink">Ofertas</h1>
        <p className="mt-gap-xs text-small text-ink-soft/75">Agrega varias opciones. Puedes guardar una y seguir añadiendo más después.</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-gap-sm border-b border-ink/10 pb-gap-sm">
        <p className="text-meta text-ink-soft/75">{offers.length}/{MAX_PACKAGES} ofertas</p>
        <button
          type="button"
          onClick={addOffer}
          disabled={saving || offers.length >= MAX_PACKAGES}
          className="inline-flex h-10 items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-small font-semibold text-ink hover:bg-sand disabled:opacity-50"
        >
          <Plus size={16} /> Agregar oferta
        </button>
      </div>

      {offers.length === 0 ? (
        <div className="flex min-h-28 flex-col items-center justify-center gap-gap-xs rounded-xl border border-dashed border-ink/15 bg-white text-center text-ink-soft/70">
          <p className="text-small">Todavía no agregas ofertas.</p>
          <p className="text-meta">Agrega paquetes, módulos o cualquier opción de tu proyecto.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-gap-sm">
          {offers.map((offer, index) => (
            <article key={offer.id} className="flex flex-col gap-gap-sm rounded-xl border border-ink/10 bg-white p-gap-md">
              <div className="flex flex-wrap items-center justify-between gap-gap-xs">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleOffer(offer.id)}
                    aria-expanded={expandedOffers.has(offer.id)}
                    className="flex w-full items-center justify-between gap-gap-xs text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-lv-display text-small font-semibold text-ink">{index === 0 ? "Primera oferta" : index === 1 ? "Segunda oferta" : `Oferta ${index + 1}`} · {offer.title.trim() || "Sin nombre"}</span>
                      {(offer.price || offer.capacity) && <span className="mt-0.5 block text-meta text-ink-soft/70">{[offer.price, offer.capacity ? `${offer.capacity} personas` : ""].filter(Boolean).join(" · ")}</span>}
                    </span>
                    <ChevronDown size={17} className={`shrink-0 text-ink-soft transition-transform ${expandedOffers.has(offer.id) ? "rotate-180" : ""}`} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => void saveOffer(offer)}
                      disabled={saving || !offer.title.trim() || isOfferSaved(offer)}
                      className="inline-flex h-9 items-center gap-1 rounded-full border border-ink/10 px-gap-sm font-lv-display text-meta font-semibold text-ink hover:bg-sand disabled:opacity-60"
                    >
                      {saving && savingOfferId === offer.id ? <Loader2 size={14} className="animate-spin" /> : isOfferSaved(offer) ? <Check size={14} /> : <Save size={14} />}
                      {saving && savingOfferId === offer.id ? "Guardando..." : isOfferSaved(offer) ? "Guardada" : "Guardar oferta"}
                    </button>
                  <button type="button" onClick={() => moveOffer(index, -1)} disabled={saving || index === 0} aria-label="Subir oferta" className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-sand disabled:opacity-40"><ArrowUp size={16} /></button>
                  <button type="button" onClick={() => moveOffer(index, 1)} disabled={saving || index === offers.length - 1} aria-label="Bajar oferta" className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-sand disabled:opacity-40"><ArrowDown size={16} /></button>
                  <button type="button" onClick={() => setOffers((current) => current.filter((_, offerIndex) => offerIndex !== index))} disabled={saving} aria-label="Eliminar oferta" className="grid size-9 place-items-center rounded-full text-ink-soft hover:bg-red-50 hover:text-red-700 disabled:opacity-40"><Trash2 size={16} /></button>
                </div>
              </div>

              {expandedOffers.has(offer.id) && (
                <div className="flex flex-col gap-gap-sm border-t border-ink/10 pt-gap-sm">
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">
                Nombre del paquete
                <input required maxLength={120} className={INPUT} placeholder="Ej. Mesa VIP, módulo o paquete familiar" value={offer.title} onChange={(event) => updateOffer(index, { title: event.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">
                Precio (opcional)
                <input maxLength={100} className={INPUT} placeholder="Ej. 50 USD o A consultar" value={offer.price} onChange={(event) => updateOffer(index, { price: event.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">
                Qué incluye
                <textarea rows={4} maxLength={2400} className={TEXTAREA} placeholder="Escribe los detalles; puedes usar varias líneas" value={offer.includes.join("\n")} onChange={(event) => updateOffer(index, { includes: event.target.value.split(/\r?\n/).slice(0, 12) })} />
              </label>
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">
                Capacidad de personas (opcional)
                <input type="number" min={1} max={100000} step={1} className={INPUT} placeholder="Ej. 10" value={offer.capacity ?? ""} onChange={(event) => updateOffer(index, { capacity: event.target.value ? Number(event.target.value) : null })} />
              </label>
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">
                Condiciones adicionales (opcional)
                <textarea rows={4} maxLength={1200} className={TEXTAREA} placeholder="Escribe las condiciones; puedes usar varias líneas" value={offer.conditions} onChange={(event) => updateOffer(index, { conditions: event.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-meta font-semibold text-ink-soft/80">
                Vigencia (opcional)
                <input type="date" className={INPUT} value={offer.validUntil} onChange={(event) => updateOffer(index, { validUntil: event.target.value })} />
              </label>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 px-gap-md py-3 text-small font-medium text-red-700">{error}</p>}
      {hasUnnamedOffer && <p role="status" className="text-meta text-ink-soft/75">Completa el nombre de cada oferta antes de guardar.</p>}

      <div className="flex justify-end border-t border-ink/10 pt-gap-md">
        <button
          type="button"
          onClick={() => void saveOffers()}
          disabled={saving || !hasChanges || hasUnnamedOffer}
          className="inline-flex h-11 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 hover:bg-verde-300 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Guardando..." : "Guardar ofertas"}
        </button>
      </div>
    </section>
  );
}
