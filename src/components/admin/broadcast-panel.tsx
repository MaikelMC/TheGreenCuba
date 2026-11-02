"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BellRing,
  History,
  Loader2,
  Megaphone,
  Search,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Skeleton, StateView } from "@/components/ui";
import { MAX_CUERPO_PUSH, recortarTexto } from "@/lib/push-texto";
import { cn } from "@/lib/utils";

/**
 * Notificaciones a usuarios: el altavoz de administración.
 *
 * Un formulario corto y el historial de lo enviado. El alcance se elige arriba
 * —todos los usuarios o una selección— y el aviso previo lo repite antes de
 * enviar, a nombre de "Support La Verde": una notificación no tiene
 * "desenviar".
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
  /** `destino` lo escribe el POST: «todos» o «seleccionados». */
  meta: { destino?: string } | null;
  createdAt: string;
}

/** Lo mínimo que el selector necesita de `/api/admin/users`. */
interface DirectoryUser {
  id: string;
  email: string;
  name: string | null;
}

const INPUT =
  "w-full rounded-xl border border-ink/10 bg-sand-warm px-3 text-small text-ink placeholder:text-ink-soft/75 outline-none transition-colors focus:border-verde-400 focus:bg-white focus:ring-2 focus:ring-verde-400/20";

const ACCION_SECUNDARIA =
  "inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-ink/10 px-gap-lg font-lv-display text-small font-semibold text-ink transition-colors hover:border-verde-300 hover:bg-verde-50";

/* El selector no pinta más de 50 filas: una lista de miles de nombres en un
   móvil con datos limitados pesa y no ayuda. La búsqueda es la forma de llegar
   al resto, y la selección hecha sobrevive al filtro. */
const VISIBLES_MAX = 50;

/** «1 usuario» / «N usuarios»: el alcance cambia de número, la frase no. */
function usuarios(n: number) {
  return `${n} ${n === 1 ? "usuario" : "usuarios"}`;
}

/* Enter dentro del selector no envía el formulario. Buscar un nombre no puede
   convertirse en el primer clic de confirmación de un aviso. */
function sinEnvio(e: React.KeyboardEvent) {
  if (e.key === "Enter") e.preventDefault();
}

export function BroadcastPanel() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [recipients, setRecipients] = useState<number | null>(null);
  /* El envío no se puede retirar, así que el primer clic pide confirmación y
     no manda nada. Cualquier edición la cancela: nunca se confirma un texto
     que ya no es el que se está viendo. */
  const [confirming, setConfirming] = useState(false);
  /* Qué aviso del historial tiene el mensaje desplegado. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /* Destino: todo el mundo por defecto, o una selección de personas. */
  const [destino, setDestino] = useState<"todos" | "personas">("todos");
  const [directorio, setDirectorio] = useState<DirectoryUser[]>([]);
  const [directorioCargando, setDirectorioCargando] = useState(false);
  const [directorioError, setDirectorioError] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const loadDirectorio = useCallback(async () => {
    setDirectorioCargando(true);
    setDirectorioError(false);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { users?: DirectoryUser[] };
      setDirectorio(data.users ?? []);
    } catch {
      setDirectorioError(true);
    } finally {
      setDirectorioCargando(false);
    }
  }, []);

  function elegirDestino(valor: "todos" | "personas") {
    setDestino(valor);
    setConfirming(false);
    if (valor === "personas" && directorio.length === 0 && !directorioError) {
      void loadDirectorio();
    }
  }

  function alternarDestinatario(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirming(false);
  }

  /* `filtrados` es el directorio entero pasado por la búsqueda; `visibles` es
     lo que se pinta. Van separados para poder decir «mostrando 50 de N» sin
     mentir. */
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return directorio;
    return directorio.filter((user) =>
      [user.name, user.email].some((value) =>
        value?.toLowerCase().includes(q),
      ),
    );
  }, [busqueda, directorio]);

  const visibles = filtrados.slice(0, VISIBLES_MAX);

  function marcarVisibles() {
    setSeleccionados((prev) => new Set([...prev, ...visibles.map((u) => u.id)]));
    setConfirming(false);
  }

  function limpiarSeleccion() {
    setSeleccionados(new Set());
    setConfirming(false);
  }

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setHistoryError(false);
    try {
      const res = await fetch("/api/admin/broadcast");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        broadcasts: Broadcast[];
        recipients?: number;
      };
      setHistory(data.broadcasts);
      setRecipients(
        typeof data.recipients === "number" ? data.recipients : null,
      );
    } catch {
      setHistoryError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (destino === "personas" && seleccionados.size === 0) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          ...(destino === "personas"
            ? { recipientIds: [...seleccionados] }
            : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        recipients?: number;
        error?: string;
      } | null;
      if (!res.ok || !data) {
        toast.error(data?.error ?? "No se pudo enviar el aviso.");
        return;
      }
      toast.success(
        data.recipients
          ? `Aviso enviado a ${usuarios(data.recipients)}.`
          : "Aviso enviado.",
      );
      setTitle("");
      setMessage("");
      /* La selección se vacía al enviar: si se quedara, un segundo envío
         repetiría el mismo grupo sin que nadie lo haya vuelto a elegir. */
      setSeleccionados(new Set());
      setConfirming(false);
      void loadHistory();
    } catch {
      toast.error("No hubo respuesta del servidor. Revisa tu conexión.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <header className="mx-auto w-full max-w-5xl mb-gap-lg">
        <h1 className="font-lv-display text-[clamp(28px,5vw,44px)] font-bold text-ink">
          Notificaciones
        </h1>
        <p className="mt-gap-xs text-small text-ink-soft/75 text-pretty">
          Avisos a nombre de{" "}
          <span className="font-semibold text-ink">Support La Verde</span>
          {recipients !== null ? (
            <>
              {" · "}
              <span className="font-semibold text-verde-700">
                {usuarios(recipients)}
              </span>
            </>
          ) : null}
        </p>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-gap-md lg:grid-cols-2">
        {/* Formulario */}
        <form
          onSubmit={handleSend}
          className="rounded-2xl border border-ink/5 bg-surface p-gap-md flex flex-col gap-gap-sm"
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
            Un aviso enviado no se puede retirar.
          </p>

          <fieldset className="flex flex-col gap-gap-xs" onKeyDown={sinEnvio}>
            <legend className="mb-gap-2xs text-meta font-medium text-ink-soft/75">
              Destinatarios
            </legend>
            <div className="flex gap-gap-xs">
              {(
                [
                  ["todos", "Todos"],
                  ["personas", "Personas"],
                ] as const
              ).map(([valor, etiqueta]) => (
                <label
                  key={valor}
                  className={cn(
                    "flex min-h-11 flex-1 cursor-pointer items-center gap-gap-xs rounded-xl border px-3 text-small font-medium transition-colors",
                    destino === valor
                      ? "border-verde-300 bg-verde-50 text-verde-800"
                      : "border-ink/10 text-ink-soft/75 hover:bg-sand",
                  )}
                >
                  <input
                    type="radio"
                    name="destinatarios"
                    value={valor}
                    checked={destino === valor}
                    onChange={() => elegirDestino(valor)}
                    className="size-4 shrink-0 accent-verde-600"
                  />
                  {etiqueta}
                </label>
              ))}
            </div>
          </fieldset>

          {destino === "personas" ? (
            <div className="flex flex-col gap-gap-xs">
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={sinEnvio}
                placeholder="Buscar por nombre o correo"
                aria-label="Buscar destinatarios"
                className={`${INPUT} h-11`}
              />

              {directorioCargando ? (
                <p className="py-gap-sm text-meta text-ink-soft/75">
                  Cargando usuarios…
                </p>
              ) : directorioError ? (
                <StateView
                  size="sm"
                  variant="error"
                  icon={TriangleAlert}
                  title="No se pudo cargar la lista de usuarios"
                  description="Revisa la conexión e intenta de nuevo."
                  actions={
                    <button
                      type="button"
                      onClick={() => void loadDirectorio()}
                      className={ACCION_SECUNDARIA}
                    >
                      Reintentar
                    </button>
                  }
                />
              ) : filtrados.length === 0 ? (
                <p className="py-gap-sm text-meta text-ink-soft/75">
                  {directorio.length === 0
                    ? "No hay usuarios con cuenta activa."
                    : "Ningún usuario coincide con la búsqueda."}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-gap-xs">
                    <span
                      className="text-meta text-ink-soft/75"
                      aria-live="polite"
                    >
                      {seleccionados.size === 0
                        ? "Ninguno seleccionado"
                        : `${seleccionados.size} ${
                            seleccionados.size === 1
                              ? "seleccionado"
                              : "seleccionados"
                          }`}
                    </span>
                    <span className="flex items-center gap-gap-sm">
                      <button
                        type="button"
                        onClick={marcarVisibles}
                        className="min-h-11 cursor-pointer px-1 font-lv-display text-meta font-semibold text-verde-700"
                      >
                        Seleccionar visibles
                      </button>
                      <button
                        type="button"
                        onClick={limpiarSeleccion}
                        disabled={seleccionados.size === 0}
                        className="min-h-11 cursor-pointer px-1 font-lv-display text-meta font-semibold text-ink-soft/75 disabled:cursor-default disabled:opacity-50"
                      >
                        Limpiar
                      </button>
                    </span>
                  </div>
                  <div
                    className="max-h-[280px] divide-y divide-ink/5 overflow-y-auto rounded-xl border border-ink/10"
                    onKeyDown={sinEnvio}
                  >
                    {visibles.map((user) => (
                      <label
                        key={user.id}
                        className="flex min-h-11 cursor-pointer items-center gap-gap-sm px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          checked={seleccionados.has(user.id)}
                          onChange={() => alternarDestinatario(user.id)}
                          className="size-4 shrink-0 accent-verde-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-small font-medium text-ink">
                            {user.name || "Sin nombre"}
                          </span>
                          <span className="block truncate text-xs text-ink-soft/75">
                            {user.email}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {filtrados.length > visibles.length ? (
                    <p className="text-xs text-ink-soft/75">
                      Mostrando {visibles.length} de {filtrados.length}. Afina la
                      búsqueda para llegar al resto.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setConfirming(false);
            }}
            maxLength={120}
            required
            placeholder="Título del aviso. Ej: «Nueva función: rutas a pie»"
            aria-label="Título del aviso"
            className={`${INPUT} h-11`}
          />
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setConfirming(false);
            }}
            maxLength={2000}
            required
            rows={5}
            placeholder="Mensaje del aviso. Sé breve: se lee en una notificación."
            aria-label="Mensaje del aviso"
            className={`${INPUT} min-h-[120px] resize-y py-3`}
          />

          {/* En la notificación del móvil caben dos líneas; el resto se corta
              con puntos suspensivos. El mensaje completo se lee igual en la
              bandeja de la app, pero quien envía tiene que ver lo que de verdad
              va a asomar en la pantalla antes de confirmarlo. */}
          {(title.trim() || message.trim()) && (
            <div className="rounded-xl border border-ink/10 bg-sand-warm px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft/60">
                Vista previa en el móvil
              </p>
              <p className="mt-1 line-clamp-2 font-lv-display text-small font-semibold text-ink">
                {title.trim() || "Sin título"}
              </p>
              <p className="mt-0.5 text-meta text-ink-soft/75">
                {recortarTexto(message, MAX_CUERPO_PUSH) || "Sin mensaje"}
              </p>
            </div>
          )}

          {confirming ? (
            /* Ámbar, no verde: es un estado, no una acción. Va con icono y
               texto, así que el color no es el único aviso. */
            <div
              role="status"
              className="flex items-start gap-gap-xs rounded-xl border border-amber-200 bg-amber-50 px-gap-sm py-gap-xs text-amber-700"
            >
              <TriangleAlert
                size={14}
                strokeWidth={2}
                className="mt-0.5 shrink-0"
              />
              <p className="text-meta font-medium text-pretty">
                Revisa el texto:{" "}
                {destino === "personas"
                  ? `se enviará a ${usuarios(seleccionados.size)}`
                  : recipients !== null
                    ? `se enviará a ${usuarios(recipients)}`
                    : "se enviará a todos los usuarios"}{" "}
                y no se puede retirar.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-gap-sm self-start">
            <button
              type="submit"
              disabled={
                sending ||
                title.trim().length === 0 ||
                message.trim().length === 0 ||
                (destino === "personas" && seleccionados.size === 0)
              }
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 disabled:opacity-50 disabled:pointer-events-none"
            >
              {sending ? (
                <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
              ) : (
                <BellRing size={16} strokeWidth={1.8} />
              )}
              {sending
                ? "Enviando…"
                : confirming
                  ? "Confirmar envío"
                  : destino === "personas"
                    ? `Enviar a ${usuarios(seleccionados.size)}`
                    : "Enviar a todos"}
            </button>
            {confirming && !sending ? (
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-11 cursor-pointer rounded-full px-gap-md font-lv-display text-small font-semibold text-ink-soft/75 transition-colors duration-500 ease-outquint hover:text-ink"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        {/* Historial */}
        <div className="rounded-2xl border border-ink/5 bg-surface p-gap-md">
          <div className="inline-flex items-center gap-gap-xs mb-gap-sm">
            <span className="grid size-9 place-items-center rounded-xl bg-ink/5 text-ink-soft/75">
              <History size={18} strokeWidth={1.8} />
            </span>
            <h2 className="font-lv-display text-body font-semibold text-ink">
              Historial de envíos
            </h2>
          </div>

          {loading ? (
            /* Skeleton con la forma real de la fila (título, mensaje, fecha):
               la lista no salta al llegar los datos. */
            <div className="flex flex-col" aria-busy="true">
              <span className="sr-only">Cargando el historial…</span>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex flex-col gap-gap-xs border-b border-ink/5 py-gap-sm last:border-b-0"
                >
                  {/* `bg-ink/5` en vez del `bg-sand-deep` de serie: en el
                      panel oscuro ese token cae en el tono de la página y los
                      huesos quedaban casi invisibles sobre la tarjeta. */}
                  <Skeleton className="h-[14px] w-[55%] rounded-md bg-ink/5" />
                  <Skeleton className="h-[12px] w-[85%] rounded-md bg-ink/5" />
                  <Skeleton className="h-[12px] w-[40%] rounded-md bg-ink/5" />
                </div>
              ))}
            </div>
          ) : historyError ? (
            <StateView
              size="sm"
              variant="error"
              icon={TriangleAlert}
              title="No se pudo cargar el historial"
              description="Revisa la conexión e intenta de nuevo."
              actions={
                <button
                  type="button"
                  onClick={() => void loadHistory()}
                  className={ACCION_SECUNDARIA}
                >
                  Reintentar
                </button>
              }
            />
          ) : history.length === 0 ? (
            <div className="py-gap-md text-meta text-ink-soft/75">
              Todavía no se ha enviado ningún aviso.
            </div>
          ) : (
            <ol className="flex flex-col">
              {history.map((b) => {
                /* Ponytail: umbral de caracteres para saber si el mensaje pasa
                   de dos líneas, sin medir el DOM. Si el ancho de la tarjeta o
                   el texto cambian mucho, se queda corto; ahí tocaría medir. */
                const largo = b.message.length > 140;
                const abierto = expandedId === b.id;
                return (
                  <li
                    key={b.id}
                    className="py-gap-sm border-b border-ink/5 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-gap-xs">
                      <span className="font-lv-display text-small font-semibold text-ink truncate">
                        {b.title}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-gap-2xs text-xs text-ink-soft/75">
                        <Users size={12} strokeWidth={1.8} />
                        <span className="sr-only">Destinatarios: </span>
                        {b.recipientCount}
                      </span>
                    </div>
                    <p
                      id={`aviso-${b.id}`}
                      className={cn(
                        "text-meta text-ink-soft/75 mt-0.5 text-pretty",
                        largo && !abierto && "line-clamp-2",
                      )}
                    >
                      {b.message}
                    </p>
                    <div className="mt-0.5 flex items-start justify-between gap-gap-sm">
                      <p className="text-meta text-ink-soft/75">
                        {b.senderName ?? "Administración"}
                        {b.meta?.destino === "seleccionados" ? " · selección" : ""} ·{" "}
                        {new Date(b.createdAt).toLocaleString("es-CU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {largo ? (
                        /* El relleno invisible del `::after` lleva el área
                           táctil a 44px sin engordar la fila. */
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(abierto ? null : b.id)
                          }
                          aria-expanded={abierto}
                          aria-controls={`aviso-${b.id}`}
                          className="relative shrink-0 font-lv-display text-meta font-semibold text-verde-700 after:absolute after:-inset-x-1 after:-inset-y-[14px] after:content-['']"
                        >
                          {abierto ? "Ver menos" : "Ver completo"}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
