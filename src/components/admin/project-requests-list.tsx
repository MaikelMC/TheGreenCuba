"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, MapPin, Megaphone, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProjectRequest {
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
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

const STATUS_LABEL: Record<ProjectRequest["status"], string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export function ProjectRequestsList() {
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<ProjectRequest | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/project-requests?status=pending");
    if (!response.ok) {
      setError("No se pudieron cargar las solicitudes de proyectos.");
      setLoading(false);
      return;
    }
    setRequests((await response.json()) as ProjectRequest[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: "approved" | "rejected", adminNote?: string) {
    setWorkingId(id);
    try {
      const response = await fetch(`/api/project-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });
      if (!response.ok) {
        setError("No se pudo actualizar la solicitud.");
        return false;
      }
      setRequests((current) => current.filter((request) => request.id !== id));
      setError(null);
      return true;
    } catch {
      setError("No se pudo actualizar la solicitud.");
      return false;
    } finally {
      setWorkingId(null);
    }
  }

  async function rejectRequest() {
    if (!rejection) return;
    const updated = await updateStatus(rejection.id, "rejected", rejectionMessage.trim());
    if (updated) {
      setRejection(null);
      setRejectionMessage("");
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-gap-lg">
      <div>
        <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.12em] text-verde-600">Moderación</p>
        <h1 className="mt-gap-xs font-lv-display text-[clamp(28px,5vw,44px)] font-bold tracking-[-0.03em] text-ink">Solicitudes de proyectos</h1>
        <p className="mt-gap-sm text-body text-ink-soft/75">Revisa las propuestas antes de publicarlas en el mapa.</p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-gap-md py-3 text-small font-medium text-red-700">{error}</p>}
      {loading && <div className="flex items-center gap-gap-xs text-small text-ink-soft/75"><Loader2 size={18} className="animate-spin" /> Cargando solicitudes...</div>}
      {!loading && requests.length === 0 && <div className="rounded-2xl border border-ink/10 bg-white p-gap-lg text-small text-ink-soft/75">No hay solicitudes de proyectos pendientes.</div>}

      <div className="grid gap-gap-md">
        {requests.map((request) => (
          <article key={request.id} className="rounded-2xl border border-ink/10 bg-white p-gap-lg shadow-[0_18px_50px_-32px_rgba(20,42,30,0.45)]">
            <div className="flex flex-wrap items-start justify-between gap-gap-md">
              <div className="flex items-start gap-gap-sm">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-verde-50 text-verde-700"><Megaphone size={21} /></span>
                <div>
                  <h2 className="font-lv-display text-[22px] font-bold text-ink">{request.name}</h2>
                  <p className="text-meta text-ink-soft/70">{STATUS_LABEL[request.status]} · {new Date(request.createdAt).toLocaleDateString("es-CU")}</p>
                </div>
              </div>
              <div className="flex gap-gap-xs">
                <button type="button" disabled={workingId === request.id} onClick={() => { setRejection(request); setRejectionMessage(""); }} className="inline-flex h-10 items-center gap-gap-xs rounded-full border border-red-200 px-gap-md font-lv-display text-small font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><X size={16} /> Rechazar</button>
                <button type="button" disabled={workingId === request.id} onClick={() => void updateStatus(request.id, "approved")} className="inline-flex h-10 items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 hover:bg-verde-300 disabled:opacity-50"><Check size={16} /> Aprobar</button>
              </div>
            </div>
            <p className="mt-gap-md text-small leading-relaxed text-ink-soft/85">{request.description}</p>
            <div className="mt-gap-md grid gap-gap-sm border-t border-ink/10 pt-gap-md text-small text-ink-soft/80 sm:grid-cols-2">
              <p><strong className="text-ink">Contacto:</strong> {request.contact} · {request.phones.join(", ")}</p>
              <p className="flex items-start gap-gap-xs"><MapPin size={16} className="mt-0.5 shrink-0 text-verde-600" /><span><strong className="text-ink">Lugar:</strong> {request.venueName}<br />{request.provinces.join(", ")} · {request.lat.toFixed(5)}, {request.lng.toFixed(5)}</span></p>
              <p><strong className="text-ink">Fechas:</strong> {request.startsAt} a {request.endsAt}</p>
              {request.socialLinks.length > 0 && <p><strong className="text-ink">Redes:</strong> {request.socialLinks.join(", ")}</p>}
              {request.offers && <p className="sm:col-span-2"><strong className="text-ink">Ofertas y catálogo:</strong> {request.offers}</p>}
            </div>
          </article>
        ))}
      </div>

      <Dialog
        open={rejection !== null}
        onOpenChange={(open) => {
          if (!open && workingId === null) setRejection(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar proyecto</DialogTitle>
            <DialogDescription>
              {rejection
                ? `«${rejection.name}» recibirá una notificación. Puedes explicar por qué no se aprueba.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <textarea
            value={rejectionMessage}
            onChange={(event) => setRejectionMessage(event.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Motivo del rechazo (opcional)"
            aria-label="Motivo del rechazo"
            className="min-h-[112px] w-full resize-y rounded-xl border border-ink/10 bg-white px-3 py-3 text-small text-ink outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20"
            disabled={workingId !== null}
          />

          <DialogFooter className="gap-gap-xs sm:gap-gap-xs">
            <DialogClose asChild>
              <button type="button" className="rounded-full border border-ink/10 px-gap-md py-[10px] text-small font-semibold text-ink-soft/75">
                Cancelar
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={() => void rejectRequest()}
              disabled={workingId !== null}
              className="inline-flex items-center justify-center gap-gap-xs rounded-full bg-destructive px-gap-md py-[10px] text-small font-semibold text-white disabled:opacity-60"
            >
              {workingId ? "Enviando…" : "Rechazar y notificar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
