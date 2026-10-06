"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  Bell,
  CheckCheck,
  Clock3,
  MailOpen,
  Megaphone,
} from "lucide-react";

interface UserNotification {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  placeId: string | null;
  /** Remitente visible de los avisos de administración. */
  senderName?: string | null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * La burbuja de notificaciones del mapa.
 *
 * En la esquina superior derecha, debajo de los filtros: un disco con la
 * campana que abre la lista encima del mapa, sin salir de la pantalla. Es la
 * misma lista que `/notifications` —misma ruta, mismo `PATCH`— en versión
 * corta; la pantalla completa sigue siendo el destino de «Ver todas».
 *
 * Sin sesión la ruta contesta 401 y la burbuja no se pinta: no hay nada que
 * enseñar bajo la campana. Ausencia de sesión no es «cero notificaciones», así
 * que no se ofrece una entrada vacía.
 */
export function MapNotifications() {
  const router = useRouter();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [hasSession, setHasSession] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/notifications").catch(() => null);
    if (!response) return;
    if (!response.ok) {
      setHasSession(false);
      return;
    }
    const data = (await response.json().catch(() => null)) as
      | UserNotification[]
      | null;
    if (!Array.isArray(data)) return;
    setItems(data);
    setHasSession(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* Al abrir se refresca: la burbuja puede llevar horas montada y la lista en
     memoria ser de la última vez. */
  const toggle = useCallback(() => {
    setOpen((current) => {
      if (!current) void load();
      return !current;
    });
  }, [load]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const markAllRead = useCallback(async () => {
    setItems((current) =>
      current.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
    );
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {});
  }, []);

  /* Mismo destino que la pantalla completa: un aviso de rechazo lleva al panel
     del negocio, uno con lugar a la ficha, y el resto al perfil. */
  const handleOpen = useCallback(
    (item: UserNotification) => {
      if (!item.readAt) {
        fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id }),
        }).catch(() => {});
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, readAt: entry.readAt ?? new Date().toISOString() }
              : entry,
          ),
        );
      }

      setOpen(false);

      if (item.title.toLowerCase().includes("rechazada")) {
        router.push("/profile?seccion=negocio");
        return;
      }
      if (item.placeId) {
        router.push(`/place/${item.placeId}`);
        return;
      }
      router.push("/profile");
    },
    [router],
  );

  if (!hasSession) return null;

  const unread = items.filter((item) => !item.readAt).length;

  return (
    <div ref={ref} className="absolute right-gutter top-[110px] z-30">
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        onClick={toggle}
        aria-expanded={open}
        aria-label={
          unread > 0
            ? `Notificaciones, ${unread} sin leer`
            : "Notificaciones"
        }
        className="relative grid size-11 place-items-center rounded-full border border-ink/10 bg-white text-ink shadow-soft transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-600"
      >
        <Bell size={18} strokeWidth={1.8} />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute right-[2px] top-[2px] grid place-items-center"
          >
            {/* El halo que late es lo que hace que se vea de reojo; el punto
                sólido queda para quien pide menos movimiento. */}
            <motion.span
              className="absolute size-3 rounded-full bg-verde-500"
              animate={{ opacity: [0.6, 0], scale: [1, 2.1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
            <span className="relative size-3 rounded-full bg-verde-500 ring-2 ring-white" />
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-[calc(100%+8px)] w-[min(340px,calc(100vw-40px))] overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-card"
          >
            <header className="flex items-center justify-between gap-3 border-b border-ink/5 bg-sand px-gap-md py-gap-sm">
              <div className="min-w-0">
                <p className="font-lv-display text-small font-semibold text-ink">
                  Notificaciones
                </p>
                <p className="text-meta text-ink-soft/75">
                  {unread > 0 ? `${unread} sin leer` : "Todo al día"}
                </p>
              </div>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="inline-flex shrink-0 items-center gap-[5px] rounded-full border border-ink/10 bg-white px-3 py-1.5 text-meta font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:text-verde-700"
                >
                  <CheckCheck size={14} strokeWidth={1.8} />
                  Leídas
                </button>
              )}
            </header>

            {items.length === 0 ? (
              <div className="px-gap-md py-10 text-center">
                <MailOpen
                  size={24}
                  strokeWidth={1.7}
                  className="mx-auto text-verde-600"
                />
                <p className="mt-2 font-lv-display text-small font-semibold text-ink">
                  No tienes notificaciones
                </p>
                <p className="mt-1 text-meta text-ink-soft/75">
                  Aquí aparecerán las novedades sobre tus solicitudes.
                </p>
              </div>
            ) : (
              <div className="max-h-[min(60vh,380px)] overflow-y-auto">
                {items.map((item) => {
                  const isUnread = !item.readAt;
                  const isRejected = item.title
                    .toLowerCase()
                    .includes("rechazada");
                  const isApproved = item.title
                    .toLowerCase()
                    .includes("aprobada");

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleOpen(item)}
                      className={`flex w-full items-start gap-gap-sm border-b border-ink/5 px-gap-md py-gap-sm text-left transition-colors duration-500 ease-outquint last:border-b-0 ${
                        isUnread
                          ? "bg-verde-50/80 hover:bg-verde-50"
                          : "bg-white hover:bg-sand-warm"
                      }`}
                    >
                      <span
                        className={`mt-[2px] grid size-8 shrink-0 place-items-center rounded-full border ${
                          isUnread
                            ? "border-verde-200 bg-white text-verde-600"
                            : "border-ink/10 bg-sand text-ink-soft/60"
                        }`}
                      >
                        {item.senderName ? (
                          <Megaphone size={15} strokeWidth={1.8} />
                        ) : isRejected ? (
                          <AlertCircle size={15} strokeWidth={1.8} />
                        ) : isApproved ? (
                          <CheckCheck size={15} strokeWidth={1.8} />
                        ) : (
                          <Bell size={15} strokeWidth={1.8} />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-lv-display text-small font-semibold text-ink">
                            {item.title}
                          </span>
                          {isUnread && (
                            <span className="size-2 shrink-0 rounded-full bg-verde-500" />
                          )}
                        </span>
                        {item.senderName && (
                          <span className="mt-[2px] block font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em] text-verde-600">
                            {item.senderName}
                          </span>
                        )}
                        <span className="mt-[4px] line-clamp-2 block text-meta leading-relaxed text-ink-soft/80">
                          {item.message}
                        </span>
                        <span className="mt-[6px] inline-flex items-center gap-[5px] text-[11px] text-ink-soft/60">
                          <Clock3 size={12} strokeWidth={1.8} />
                          {formatDate(item.createdAt)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/notifications");
              }}
              className="w-full border-t border-ink/5 bg-white px-gap-md py-gap-sm text-center font-lv-display text-small font-semibold text-verde-600 transition-colors duration-500 ease-outquint hover:bg-verde-50"
            >
              Ver todas
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
