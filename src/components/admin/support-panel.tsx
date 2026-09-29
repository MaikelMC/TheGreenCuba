"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  CheckCheck,
  LifeBuoy,
  Loader2,
  Search,
  Send,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StateView } from "@/components/ui/state-view";
import { LoadingState } from "@/components/ui/loading";

/**
 * Soporte: la mesa de ayuda del panel.
 *
 * Lista los tickets que la app acumula desde Configuración → "Reportar un
 * error", con filtros por estado y búsqueda por texto. Responder guarda la
 * respuesta y la envía por correo al usuario (Resend); el panel avisa si el
 * correo no pudo salir, y permite seguir moviendo el estado sin reenviar.
 */

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  adminReply: string | null;
  repliedAt: string | null;
  pagePath: string | null;
  email: string;
  userSnapshot: { name: string | null; email: string } | null;
  createdAt: string;
}

const STATUS_META: Record<Ticket["status"], { label: string; cls: string }> = {
  open: { label: "Abierto", cls: "bg-verde-50 text-verde-700 border-verde-200" },
  in_progress: { label: "En curso", cls: "bg-sand text-ink-soft/75 border-ink/10" },
  resolved: { label: "Resuelto", cls: "bg-verde-100 text-verde-700 border-verde-200" },
  closed: { label: "Archivado", cls: "bg-sand-deep text-ink-soft/75 border-ink/10" },
};

const FILTER =
  "h-[42px] px-3 rounded-xl border border-ink/10 bg-white font-lv-display text-small text-ink outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20 cursor-pointer";

export function SupportPanel() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  /* El ticket abierto en el panel de respuesta. */
  const [replying, setReplying] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/support?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { tickets: Ticket[] };
      setTickets(data.tickets);
    } catch {
      toast.error("No se pudieron cargar los tickets.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) =>
      `${t.subject} ${t.message} ${t.userSnapshot?.name ?? ""} ${t.userSnapshot?.email ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [tickets, query]);

  async function sendReply() {
    if (!replying || reply.trim().length === 0) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: replying.id, reply }),
      });
      const data = (await res.json().catch(() => null)) as {
        ticket?: Ticket;
        emailSent?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ticket) {
        toast.error(data?.error ?? "No se pudo responder el ticket.");
        return;
      }
      toast.success(
        data.emailSent
          ? "Respuesta enviada al correo del usuario."
          : "Respuesta guardada, pero el correo no pudo enviarse (Resend sin configurar o rechazado).",
        { duration: 6000 },
      );
      setTickets((current) =>
        current.map((t) => (t.id === data.ticket!.id ? data.ticket! : t)),
      );
      setReplying(null);
      setReply("");
    } finally {
      setSending(false);
    }
  }

  async function setStatus(ticket: Ticket, status: Ticket["status"]) {
    const res = await fetch("/api/admin/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticket.id, status }),
    });
    const data = (await res.json().catch(() => null)) as { ticket?: Ticket } | null;
    if (!res.ok || !data?.ticket) {
      toast.error("No se pudo actualizar el estado.");
      return;
    }
    setTickets((current) =>
      current.map((t) => (t.id === data.ticket!.id ? data.ticket! : t)),
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-md">
        <h1 className="sr-only">Soporte</h1>
        <p className="text-small text-ink-soft/75">
          Tickets de los usuarios, ordenados del más reciente al más viejo
        </p>
      </div>

      <div className="mb-gap-md flex flex-col gap-gap-sm sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/75 pointer-events-none"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por asunto, mensaje o usuario..."
            aria-label="Buscar tickets"
            className={cn(FILTER, "w-full pl-9 text-body")}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={FILTER}
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos los estados</option>
          <option value="open">Abiertos</option>
          <option value="in_progress">En curso</option>
          <option value="resolved">Resueltos</option>
          <option value="closed">Archivados</option>
        </select>
      </div>

      {loading ? (
        <LoadingState label="Cargando tickets…" />
      ) : visible.length === 0 ? (
        <StateView
          size="sm"
          icon={LifeBuoy}
          title="No hay tickets"
          description="Cuando un usuario reporte un error desde Configuración, aparecerá aquí."
          className="rounded-2xl border border-ink/5 bg-white shadow-soft"
        />
      ) : (
        <div className="flex flex-col gap-gap-sm">
          {visible.map((ticket, index) => {
            const meta = STATUS_META[ticket.status];
            return (
              <motion.article
                key={ticket.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.3 }}
                className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft"
              >
                <div className="flex flex-wrap items-start justify-between gap-gap-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-gap-xs flex-wrap">
                      <h3 className="font-lv-display text-small font-semibold text-ink">
                        {ticket.subject}
                      </h3>
                      <span
                        className={cn(
                          "inline-flex items-center px-[8px] py-[2px] rounded-full border font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em]",
                          meta.cls,
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-meta text-ink-soft/75 mt-[2px]">
                      {ticket.userSnapshot?.name ?? "Usuario"} · {ticket.userSnapshot?.email ?? ticket.email} ·{" "}
                      {new Date(ticket.createdAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                      {ticket.pagePath ? ` · ${ticket.pagePath}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-[6px] shrink-0">
                    {ticket.status === "open" && (
                      <button
                        type="button"
                        onClick={() => void setStatus(ticket, "in_progress")}
                        className="inline-flex items-center gap-[4px] rounded-full border border-ink/10 px-gap-sm py-2 font-lv-display text-meta font-semibold text-ink-soft/75 transition-colors duration-500 hover:border-verde-300 hover:text-verde-600"
                      >
                        <Wrench size={14} strokeWidth={1.8} />
                        Atender
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setReplying(ticket);
                        setReply(ticket.adminReply ?? "");
                      }}
                      className="inline-flex items-center gap-[4px] rounded-full bg-verde-400 px-gap-sm py-2 font-lv-display text-meta font-semibold text-verde-950 transition-colors duration-500 hover:bg-verde-300"
                    >
                      <Send size={14} strokeWidth={1.8} />
                      {ticket.adminReply ? "Ver respuesta" : "Responder"}
                    </button>
                  </div>
                </div>

                <p className="mt-gap-xs text-small text-ink text-pretty whitespace-pre-wrap">
                  {ticket.message}
                </p>

                {ticket.adminReply && (
                  <div className="mt-gap-xs rounded-xl bg-verde-50 border border-verde-200 p-gap-sm text-small text-verde-700">
                    <span className="font-lv-display font-semibold">Respuesta:</span>{" "}
                    {ticket.adminReply}
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>
      )}

      {/* Panel de respuesta. Un dialog sencillo del sistema. */}
      {replying && (
        <div
          className="fixed inset-0 z-[400] grid place-items-center bg-ink/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Responder ticket"
          onClick={(e) => {
            if (e.target === e.currentTarget && !sending) setReplying(null);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-gap-lg shadow-soft">
            <h3 className="font-lv-display text-body font-semibold text-ink">
              Responder a {replying.userSnapshot?.name ?? replying.email}
            </h3>
            <p className="text-meta text-ink-soft/75 mt-[2px]">
              Se envía por correo a {replying.email} y queda en el ticket.
            </p>

            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={5}
              maxLength={3000}
              placeholder="Escribe la respuesta para el usuario..."
              aria-label="Respuesta al ticket"
              className="mt-gap-sm min-h-[120px] w-full resize-y rounded-xl border border-ink/10 bg-sand-warm px-3 py-3 text-small text-ink outline-none transition-colors focus:border-verde-400 focus:bg-white focus:ring-2 focus:ring-verde-400/20"
            />

            <div className="mt-gap-sm flex items-center justify-end gap-gap-xs">
              <button
                type="button"
                onClick={() => setReplying(null)}
                disabled={sending}
                className="rounded-full border border-ink/10 px-gap-md py-[10px] text-small font-semibold text-ink-soft/75"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void sendReply()}
                disabled={sending || reply.trim().length === 0}
                className="inline-flex items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md py-[10px] font-lv-display text-small font-semibold text-verde-950 disabled:opacity-50"
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
                {sending ? "Enviando…" : "Enviar y marcar resuelto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
