"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Mail,
  Store,
  Phone,
  Trash2,
  Plus,
  CheckCircle2,
  Clock3,
  Clock,
  CreditCard,
  Tag,
  CalendarDays,
} from "lucide-react";
import { StateView } from "@/components/ui/state-view";
import { LoadingState } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import type { WaitlistEntry, WaitlistStatus } from "@/lib/waitlist-store";

/* El estado no se distingue por color de marca: "Agregado" en verde, el resto
   en arena. Antes eran lv-blue y lv-amber, que no existen en el sistema. */
const STATUS_META: Record<WaitlistStatus, { label: string; cls: string }> = {
  nuevo: { label: "Nuevo", cls: "bg-sand-deep text-ink-soft/75" },
  contactado: { label: "Contactado", cls: "bg-verde-100 text-verde-700" },
  agregado: { label: "Agregado", cls: "bg-verde-50 text-verde-600" },
};

const STATUS_ORDER: WaitlistStatus[] = ["nuevo", "contactado", "agregado"];

const CARD = "bg-white border border-ink/5 rounded-2xl shadow-soft p-gap-md";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EntryCard({
  entry,
  onStatus,
  onDelete,
  index = 0,
}: {
  entry: WaitlistEntry;
  onStatus: (id: string, status: WaitlistStatus) => void;
  onDelete: (id: string) => void;
  index?: number;
}) {
  const meta = STATUS_META[entry.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      layout
      className={cn(CARD, "flex flex-col gap-gap-md")}
    >
      <div className="flex items-start justify-between gap-gap-sm">
        <div className="flex items-center gap-gap-sm min-w-0">
          <div className="size-10 shrink-0 grid place-items-center rounded-2xl bg-verde-50 text-verde-600">
            <Store size={18} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="font-lv-display text-body font-semibold text-ink truncate">
              {entry.businessName}
            </div>
            <div className="text-meta text-ink-soft/75">
              {entry.category || "Sin categoria"} · {entry.city || "Cuba"}
            </div>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 inline-flex items-center px-[8px] py-[3px] rounded-full font-lv-display text-[11px] font-semibold",
            meta.cls,
          )}
        >
          {meta.label}
        </span>
      </div>

      {entry.address && (
        <div className="text-small text-ink-soft/75">
          {entry.address}
        </div>
      )}

      <div className="flex flex-wrap gap-gap-xs">
        {entry.schedule && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-ink/10 px-2.5 py-1 text-meta text-ink">
            <Clock size={13} strokeWidth={1.8} className="text-verde-600" />
            {entry.schedule}
          </span>
        )}
        {entry.days && entry.days.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white border border-ink/10 px-2.5 py-1 text-meta text-ink">
            <CalendarDays size={13} strokeWidth={1.8} className="text-verde-600" />
            {entry.days.join(" · ")}
          </span>
        )}
        {entry.payments.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1 rounded-full bg-verde-50 border border-verde-200 px-2.5 py-1 font-lv-display text-[11px] font-semibold text-verde-600"
          >
            <CreditCard size={12} strokeWidth={1.8} />
            {p}
          </span>
        ))}
      </div>

      {entry.description && (
        <p className="text-small text-ink-soft/75 leading-relaxed">
          {entry.description}
        </p>
      )}
      {entry.offer && (
        <div className="flex items-center gap-2 rounded-2xl bg-verde-50 border border-verde-200 px-3 py-2 text-small text-ink">
          <Tag size={14} strokeWidth={1.8} className="text-verde-600 shrink-0" />
          <span>
            <strong className="font-semibold">Oferta:</strong> {entry.offer.text}
            {entry.offer.expiry ? ` · ${entry.offer.expiry}` : ""}
          </span>
        </div>
      )}
      {entry.notes && (
        <p className="text-small text-ink-soft/75 leading-relaxed bg-sand rounded-2xl p-gap-sm">
          {entry.notes}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-gap-sm text-small text-ink-soft/75">
        <span className="inline-flex items-center gap-1.5">
          <Phone size={14} strokeWidth={1.8} />
          {entry.contactName} · {entry.phone}
        </span>
        {entry.email && (
          <span className="inline-flex items-center gap-1.5">
            <Mail size={14} strokeWidth={1.8} />
            {entry.email}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-gap-sm border-t border-ink/5 pt-gap-sm">
        <span className="inline-flex items-center gap-1.5 text-meta text-ink-soft/75">
          <Clock3 size={13} strokeWidth={1.8} />
          {formatDate(entry.createdAt)}
        </span>
        <div className="flex items-center gap-gap-sm">
          <div className="flex items-center gap-[6px]">
            {STATUS_ORDER.map((status) => (
              <motion.button
                key={status}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => onStatus(entry.id, status)}
                disabled={entry.status === status}
                aria-pressed={entry.status === status}
                className={cnStatusChip(entry.status === status)}
              >
                {STATUS_META[status].label}
              </motion.button>
            ))}
          </div>
          <Link
            href="/admin/negocios/nuevo"
            className="inline-flex items-center gap-gap-xs h-11 sm:h-9 px-gap-md rounded-full border border-ink/10 bg-white text-ink font-lv-display text-meta font-semibold hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 transition-all duration-500 ease-outquint active:scale-[0.98]"
          >
            <Plus size={14} strokeWidth={1.8} />
            Agregar
          </Link>
          <button
            type="button"
            className="size-11 sm:size-9 rounded-full border border-ink/10 grid place-items-center shrink-0 text-ink-soft/75 hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-colors duration-500 ease-outquint"
            onClick={() => onDelete(entry.id)}
            aria-label={`Eliminar solicitud de ${entry.businessName}`}
          >
            <Trash2 size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function cnStatusChip(active: boolean): string {
  return [
    "px-2.5 py-1 rounded-full font-lv-display text-[11px] font-semibold uppercase tracking-[0.08em] border transition-colors duration-500 ease-outquint",
    active
      ? "bg-verde-400 text-verde-950 border-verde-400"
      : "border-ink/10 bg-white text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600",
  ].join(" ");
}

export default function ListaDeEsperaPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // La sesión va en la cookie: el navegador la adjunta sola al mismo origen.
      const res = await fetch("/api/admin/waitlist");
      if (!res.ok) {
        setError("No autorizado o error del servidor.");
        return;
      }
      const data = (await res.json()) as WaitlistEntry[];
      setEntries(data);
    } catch {
      setError("No se pudo cargar la lista.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = useCallback(
    async (id: string, status: WaitlistStatus) => {
      const prev = entries;
      setEntries((e) => e.map((x) => (x.id === id ? { ...x, status } : x)));
      try {
        const res = await fetch(`/api/admin/waitlist/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error();
        toast.success("Estado actualizado");
      } catch {
        setEntries(prev);
        toast.error("No se pudo actualizar el estado");
      }
    },
    [entries],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!confirm(`Eliminar la solicitud de "${entry?.businessName}"?`))
        return;
      setEntries((e) => e.filter((x) => x.id !== id));
      try {
        const res = await fetch(`/api/admin/waitlist/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        toast.success("Solicitud eliminada");
      } catch {
        setEntries(entries);
        toast.error("No se pudo eliminar");
      }
    },
    [entries],
  );

  const counts = {
    nuevo: entries.filter((e) => e.status === "nuevo").length,
    contactado: entries.filter((e) => e.status === "contactado").length,
    agregado: entries.filter((e) => e.status === "agregado").length,
  };

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-md">
        <h1 className="sr-only">Lista de espera</h1>
        <p className="text-small text-ink-soft/75">
          Negocios interesados en aparecer en La Verde antes del lanzamiento.
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-gap-xs h-10 px-gap-md rounded-full border border-ink/10 bg-white text-ink font-lv-display text-meta font-semibold hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 transition-all duration-500 ease-outquint active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none shrink-0"
        >
          <CheckCircle2 size={15} strokeWidth={1.8} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-gap-md mb-gap-lg">
        {(
          [
            ["Nuevos", counts.nuevo],
            ["Contactados", counts.contactado],
            ["Agregados", counts.agregado],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className={cn(CARD, "text-center")}>
            <div className="font-lv-display text-h3 font-bold text-ink">{value}</div>
            <div className="text-meta text-ink-soft/75">{label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <LoadingState label="Cargando solicitudes…" />
      ) : error ? (
        <div
          role="alert"
          className="rounded-2xl bg-destructive/10 border border-destructive/25 px-3 py-[7px] text-meta text-destructive font-medium"
        >
          {error}
        </div>
      ) : entries.length === 0 ? (
        <StateView
          size="sm"
          icon={Store}
          title="Aún no hay solicitudes"
          description={'Cuando un negocio se registre desde la landing "Unirse a la lista", aparecerá aquí.'}
          className="rounded-2xl border border-ink/5 bg-white shadow-soft"
        />
      ) : (
        <div className="flex flex-col gap-gap-md">
          {entries.map((entry, i) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              index={i}
              onStatus={handleStatus}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </>
  );
}
