"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Bell, CheckCheck, Clock3, Inbox, MailOpen, Sparkles } from "lucide-react";

interface UserNotification {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  placeId: string | null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationsView() {
  const router = useRouter();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    fetch("/api/notifications")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: UserNotification[]) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    setItems((current) =>
      current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
    );
  }

  const unread = items.filter((item) => !item.readAt).length;
  const visibleItems = useMemo(
    () => (filter === "unread" ? items.filter((item) => !item.readAt) : items),
    [filter, items],
  );

  const handleOpen = (item: UserNotification) => {
    if (!item.readAt) {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      }).catch(() => {});
    }

    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, readAt: entry.readAt ?? new Date().toISOString() } : entry,
      ),
    );

    if (item.title.toLowerCase().includes("rechazada")) {
      router.push("/profile?seccion=negocio");
      return;
    }

    if (item.placeId) {
      router.push(`/place/${item.placeId}`);
      return;
    }

    router.push("/profile");
  };

  return (
    <section className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col bg-sand px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex items-start justify-between gap-4 border-b border-ink/10 pb-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-verde-950 text-white shadow-soft">
            <Inbox size={20} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="font-lv-display text-[26px] font-bold leading-tight text-ink">
              Notificaciones
            </h2>
            <p className="mt-1 text-meta text-ink-soft/70">
              {unread > 0 ? `${unread} sin leer` : "Todo al día"}
            </p>
          </div>
        </div>

        {unread > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="inline-flex shrink-0 items-center gap-[6px] rounded-full border border-ink/10 bg-white px-3 py-2 text-meta font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700"
          >
            <CheckCheck size={15} strokeWidth={1.8} />
            <span className="hidden sm:inline">Marcar leídas</span>
          </button>
        )}
      </header>

      <nav className="flex items-center gap-1 border-b border-ink/10 py-3" aria-label="Filtrar notificaciones">
        {(["all", "unread"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-4 py-2 text-meta font-semibold transition-colors duration-500 ease-outquint ${filter === value ? "bg-verde-950 text-white" : "text-ink-soft/70 hover:bg-white hover:text-ink"}`}
          >
            {value === "all" ? "Todas" : `Sin leer${unread > 0 ? ` (${unread})` : ""}`}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="rounded-b-2xl border-b border-ink/10 bg-white/50 p-8 text-center text-small text-ink-soft/75">
          Cargando notificaciones…
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-b-2xl border-b border-ink/10 bg-white/60 px-6 py-16 text-center shadow-soft">
          <MailOpen size={28} strokeWidth={1.7} className="mx-auto text-verde-600" />
          <p className="mt-3 font-lv-display text-small font-semibold text-ink">
            {filter === "unread" ? "No tienes mensajes sin leer" : "No tienes notificaciones"}
          </p>
          <p className="mt-1 text-meta text-ink-soft/75">
            Aquí aparecerán las novedades sobre tus solicitudes y negocios.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-b-2xl border-x border-b border-ink/10 bg-white/60 shadow-soft">
          {visibleItems.map((item) => {
            const isUnread = !item.readAt;
            const isRejected = item.title.toLowerCase().includes("rechazada");
            const isApproved = item.title.toLowerCase().includes("aprobada");

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleOpen(item)}
                className={`group flex w-full items-start gap-3 border-b border-ink/5 px-4 py-4 text-left transition-colors duration-500 ease-outquint last:border-b-0 sm:px-5 ${
                  isUnread ? "bg-verde-50/80 hover:bg-verde-50" : "bg-white/70 hover:bg-sand-warm"
                }`}
              >
                <span
                  className={`mt-1 grid size-10 shrink-0 place-items-center rounded-full border ${
                    isUnread
                      ? "border-verde-200 bg-white text-verde-600"
                      : "border-ink/10 bg-sand text-ink-soft/60"
                  }`}
                >
                  {isRejected ? (
                    <AlertCircle size={18} strokeWidth={1.8} />
                  ) : isApproved ? (
                    <CheckCheck size={18} strokeWidth={1.8} />
                  ) : (
                    <Bell size={18} strokeWidth={1.8} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-lv-display text-small font-semibold text-ink">
                          {item.title}
                        </h3>
                        {isUnread && <Sparkles size={12} strokeWidth={2} className="text-verde-600" />}
                      </div>
                      <p className="mt-[6px] line-clamp-2 text-body leading-relaxed text-ink-soft/80">
                        {item.message}
                      </p>
                    </div>

                    {isUnread && <span className="mt-1 size-2.5 shrink-0 rounded-full bg-verde-500" aria-label="Sin leer" />}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-[5px] text-[11px] text-ink-soft/60">
                      <Clock3 size={12} strokeWidth={1.8} />
                      {formatDate(item.createdAt)}
                    </span>

                    {isRejected && (
                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-1 font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive">
                        Acción requerida
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
