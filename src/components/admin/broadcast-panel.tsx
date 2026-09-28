"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { BellRing, History, Loader2, Megaphone, Users } from "lucide-react";

/**
 * Notificaciones a usuarios: el altavoz de administración.
 *
 * Un formulario corto y el historial de lo enviado. El aviso previo deja
 * claro el alcance — llega a **todos** los usuarios, a nombre de "Support La
 * Verde" — porque un envío masivo no tiene "desenviar".
 *
 * El historial viene de `admin_broadcasts`, que guarda quién lo mandó, cuándo
 * y a cuántos: la memoria del altavoz.
 */

interface Broadcast {
  id: string;
  senderName: string | null;
  title: string;
  message: string;
  recipientCount: number;
  createdAt: string;
}

const INPUT =
  "w-full rounded-xl border border-ink/10 bg-sand-warm px-3 text-small text-ink outline-none transition-colors focus:border-verde-400 focus:bg-white focus:ring-2 focus:ring-verde-400/20";

export function BroadcastPanel() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/broadcast");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { broadcasts: Broadcast[] };
      setHistory(data.broadcasts);
    } catch {
      toast.error("No se pudo cargar el historial de envíos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    fetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { users?: unknown[] } | null) =>
        setRecipients(Array.isArray(data?.users) ? data.users.length : null),
      )
      .catch(() => setRecipients(null));
  }, [loadHistory]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message }),
      });
      const data = (await res.json().catch(() => null)) as {
        recipients?: number;
        error?: string;
      } | null;
      if (!res.ok || !data) {
        toast.error(data?.error ?? "No se pudo enviar la notificación.");
        return;
      }
      toast.success(`Notificación enviada a ${data.recipients} usuario(s).`);
      setTitle("");
      setMessage("");
      void loadHistory();
    } catch {
      toast.error("No hubo respuesta del servidor. Revisa tu conexión.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-gap-sm mb-gap-md">
        <h1 className="sr-only">Notificaciones a usuarios</h1>
        <p className="text-small text-ink-soft/75">
          Avisos globales a nombre de{" "}
          <span className="font-semibold text-ink">Support La Verde</span>
          {recipients !== null ? ` · ${recipients} usuarios` : ""}
        </p>
      </div>

      <div className="grid gap-gap-md lg:grid-cols-2">
        {/* Formulario */}
        <form
          onSubmit={handleSend}
          className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft flex flex-col gap-gap-sm"
        >
          <div className="inline-flex items-center gap-gap-xs">
            <span className="grid size-9 place-items-center rounded-xl bg-verde-50 text-verde-600">
              <Megaphone size={18} strokeWidth={1.8} />
            </span>
            <h2 className="font-lv-display text-body font-semibold text-ink">
              Nuevo aviso
            </h2>
          </div>

          <p className="text-meta text-ink-soft/75 text-pretty">
            Llega a las notificaciones de **todos los usuarios**. Úsalo para
            actualizaciones, mejoras o avisos importantes: no hay forma de
            retirarlo después de enviarlo.
          </p>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
            placeholder="Título del aviso. Ej: «Nueva función: rutas a pie»"
            aria-label="Título del aviso"
            className={`${INPUT} h-11`}
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            required
            rows={5}
            placeholder="Mensaje del aviso. Sé breve: se lee en una notificación."
            aria-label="Mensaje del aviso"
            className="min-h-[120px] resize-y py-3"
          />

          <button
            type="submit"
            disabled={sending || title.trim().length === 0 || message.trim().length === 0}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-gap-xs self-start rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 disabled:opacity-50 disabled:pointer-events-none"
          >
            {sending ? (
              <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <BellRing size={16} strokeWidth={1.8} />
            )}
            {sending ? "Enviando…" : "Enviar a todos"}
          </button>
        </form>

        {/* Historial */}
        <div className="rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft">
          <div className="inline-flex items-center gap-gap-xs mb-gap-sm">
            <span className="grid size-9 place-items-center rounded-xl bg-sand text-ink-soft/75">
              <History size={18} strokeWidth={1.8} />
            </span>
            <h2 className="font-lv-display text-body font-semibold text-ink">
              Historial de envíos
            </h2>
          </div>

          {loading ? (
            <div className="py-gap-md text-meta text-ink-soft/75" aria-busy="true">
              Cargando historial…
            </div>
          ) : history.length === 0 ? (
            <div className="py-gap-md text-meta text-ink-soft/75">
              Todavía no se ha enviado ningún aviso.
            </div>
          ) : (
            <ol className="flex flex-col">
              {history.map((b, i) => (
                <motion.li
                  key={b.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className="py-gap-sm border-b border-ink/5 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-gap-xs">
                    <span className="font-lv-display text-small font-semibold text-ink truncate">
                      {b.title}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-[4px] text-[11px] text-ink-soft/75">
                      <Users size={12} strokeWidth={1.8} />
                      {b.recipientCount}
                    </span>
                  </div>
                  <p className="text-meta text-ink-soft/75 line-clamp-2 mt-[2px]">{b.message}</p>
                  <p className="text-[11px] text-ink-soft/60 mt-[2px]">
                    {b.senderName ?? "Administración"} ·{" "}
                    {new Date(b.createdAt).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </motion.li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
