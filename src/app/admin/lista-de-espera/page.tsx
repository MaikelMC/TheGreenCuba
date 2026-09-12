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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StateView } from "@/components/ui/state-view";
import { LoadingState } from "@/components/ui/loading";
import { getAdminKey } from "@/lib/admin-auth";
import type { WaitlistEntry, WaitlistStatus } from "@/lib/waitlist-store";

const STATUS_META: Record<
  WaitlistStatus,
  { label: string; variant: "info" | "warning" | "success" }
> = {
  nuevo: { label: "Nuevo", variant: "info" },
  contactado: { label: "Contactado", variant: "warning" },
  agregado: { label: "Agregado", variant: "success" },
};

const STATUS_ORDER: WaitlistStatus[] = ["nuevo", "contactado", "agregado"];

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
      className="flex flex-col gap-gap-md rounded-lv-lg border border-border bg-surface p-gap-md"
    >
      <div className="flex items-start justify-between gap-gap-sm">
        <div className="flex items-center gap-gap-sm min-w-0">
          <div className="size-10 shrink-0 grid place-items-center rounded-lv bg-accent/10 text-accent">
            <Store size={18} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="font-display text-body font-semibold truncate">
              {entry.businessName}
            </div>
            <div className="text-meta text-muted-foreground">
              {entry.category || "Sin categoria"} · {entry.city || "Cuba"}
            </div>
          </div>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </div>

      {entry.address && (
        <div className="text-small text-muted-foreground">
          {entry.address}
        </div>
      )}

      <div className="flex flex-wrap gap-gap-xs">
        {entry.schedule && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-border px-2.5 py-1 text-small text-foreground">
            <Clock size={13} strokeWidth={1.5} className="text-accent" />
            {entry.schedule}
          </span>
        )}
        {entry.days && entry.days.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface border border-border px-2.5 py-1 text-small text-foreground">
            <CalendarDays size={13} strokeWidth={1.5} className="text-accent" />
            {entry.days.join(" · ")}
          </span>
        )}
        {entry.payments.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1 rounded-full bg-surface border border-border px-2.5 py-1 font-mono text-[11px] font-medium text-foreground"
          >
            <CreditCard size={12} strokeWidth={1.5} className="text-accent" />
            {p}
          </span>
        ))}
      </div>

      {entry.description && (
        <p className="text-small text-muted-foreground leading-relaxed">
          {entry.description}
        </p>
      )}
      {entry.offer && (
        <div className="flex items-center gap-2 rounded-lv bg-lv-amber/10 border border-lv-amber/20 px-3 py-2 text-small text-foreground">
          <Tag size={14} strokeWidth={1.5} className="text-lv-amber shrink-0" />
          <span>
            <strong className="font-semibold">Oferta:</strong> {entry.offer.text}
            {entry.offer.expiry ? ` · ${entry.offer.expiry}` : ""}
          </span>
        </div>
      )}
      {entry.notes && (
        <p className="text-small text-muted-foreground leading-relaxed bg-muted rounded-lv p-gap-sm">
          {entry.notes}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-gap-sm text-small text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Phone size={14} strokeWidth={1.5} />
          {entry.contactName} · {entry.phone}
        </span>
        {entry.email && (
          <span className="inline-flex items-center gap-1.5">
            <Mail size={14} strokeWidth={1.5} />
            {entry.email}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-gap-sm border-t border-border pt-gap-sm">
        <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
          <Clock3 size={13} strokeWidth={1.5} />
          {formatDate(entry.createdAt)}
        </span>
        <div className="flex items-center gap-gap-sm">
          <div className="flex items-center gap-1">
            {STATUS_ORDER.map((status) => (
              <motion.button
                key={status}
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => onStatus(entry.id, status)}
                disabled={entry.status === status}
                className={cnStatusChip(entry.status === status)}
              >
                {STATUS_META[status].label}
              </motion.button>
            ))}
          </div>
          <Link href="/admin/negocios/nuevo">
            <Button size="sm" variant="outline">
              <Plus size={14} strokeWidth={2} />
              Agregar
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/6"
            onClick={() => onDelete(entry.id)}
            aria-label={`Eliminar solicitud de ${entry.businessName}`}
          >
            <Trash2 size={14} strokeWidth={2} />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function cnStatusChip(active: boolean): string {
  return [
    "px-2.5 py-1 rounded-full font-mono text-[11px] font-medium uppercase tracking-[0.04em] border transition-colors",
    active
      ? "bg-accent/10 text-accent border-accent/25"
      : "border-border text-muted-foreground hover:border-accent hover:text-accent",
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
      const res = await fetch("/api/admin/waitlist", {
        headers: { "x-admin-key": getAdminKey() },
      });
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
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": getAdminKey(),
          },
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
        const res = await fetch(`/api/admin/waitlist/${id}`, {
          method: "DELETE",
          headers: { "x-admin-key": getAdminKey() },
        });
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
      <div className="flex items-center justify-between gap-gap-sm mb-gap-lg">
        <div>
          <h1 className="font-display text-h3 font-bold text-foreground">
            Lista de espera
          </h1>
          <p className="text-small text-muted-foreground mt-gap-2xs">
            Negocios interesados en aparecer en La Verde antes del lanzamiento.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <CheckCircle2 size={16} strokeWidth={1.5} />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-gap-md mb-gap-lg">
        <div className="rounded-lv-lg border border-border bg-surface p-gap-md text-center">
          <div className="font-display text-h3 font-bold text-foreground">
            {counts.nuevo}
          </div>
          <div className="text-meta text-muted-foreground">Nuevos</div>
        </div>
        <div className="rounded-lv-lg border border-border bg-surface p-gap-md text-center">
          <div className="font-display text-h3 font-bold text-foreground">
            {counts.contactado}
          </div>
          <div className="text-meta text-muted-foreground">Contactados</div>
        </div>
        <div className="rounded-lv-lg border border-border bg-surface p-gap-md text-center">
          <div className="font-display text-h3 font-bold text-foreground">
            {counts.agregado}
          </div>
          <div className="text-meta text-muted-foreground">Agregados</div>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Cargando solicitudes…" />
      ) : error ? (
        <div className="rounded-lv-lg bg-destructive/10 border border-destructive/25 px-3 py-[7px] text-[12px] text-destructive font-medium">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <StateView
          size="sm"
          icon={Store}
          title="Aún no hay solicitudes"
          description={'Cuando un negocio se registre desde la landing "Unirse a la lista", aparecerá aquí.'}
          className="rounded-lv-lg border border-border bg-surface"
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
