"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Clock3,
  LifeBuoy,
  Loader2,
  Search,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import type {
  AdminSoporte,
  ConversacionSoporte,
  DatosSoporteAdmin,
  RespuestaGuardada,
  TiempoMedioRespuesta,
} from "@/lib/admin-soporte";
import { LoadingState } from "@/components/ui/loading";
import { ControlSegmentado } from "@/components/admin/ui/segmentado";
import { ChapitaEstado } from "@/components/admin/ui/chapita";
import { EstadoVacioAdmin } from "@/components/admin/ui/tarjeta";
import { TARJETA_ADMIN } from "@/components/admin/ui/clases";
import { ChatSoporte } from "./soporte/chat-soporte";
import { ContextoSoporte } from "./soporte/contexto-soporte";
import { RespuestasGuardadas } from "./soporte/respuestas-guardadas";
import {
  duracion,
  ESTADO_CONVERSACION,
  FECHA_HORA,
  iniciales,
} from "./soporte/comun";

type FiltroEstado = "abiertas" | "resueltas" | "todas";

const FILTROS: FiltroEstado[] = ["abiertas", "resueltas", "todas"];

/**
 * La mesa de ayuda del panel.
 *
 * Escritorio: conversaciones, chat y contexto en tres columnas. Móvil: la
 * lista y, al abrir un ticket, el contexto arriba del chat con una flecha para
 * volver. La conversación abierta vive en `?ticket=` para que el enlace se
 * pueda compartir y el botón atrás del navegador tenga algo que deshacer.
 *
 * Responder, cerrar y asignar pasan por `/api/admin/support`; las respuestas
 * guardadas tienen su ruta propia. Ningún botón queda sin acción.
 */
export function SupportPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticket");
  const estadoUrl = searchParams.get("estado");
  const estado: FiltroEstado =
    estadoUrl === "resueltas" || estadoUrl === "todas" ? estadoUrl : "abiertas";

  const [tickets, setTickets] = useState<ConversacionSoporte[]>([]);
  const [admins, setAdmins] = useState<AdminSoporte[]>([]);
  const [yo, setYo] = useState<AdminSoporte | null>(null);
  const [tiempo, setTiempo] = useState<TiempoMedioRespuesta | null>(null);
  const [resumen, setResumen] = useState({
    abiertas: 0,
    sinAsignar: 0,
    mias: 0,
  });
  const [respuestas, setRespuestas] = useState<RespuestaGuardada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [respuestasAbiertas, setRespuestasAbiertas] = useState(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const [respuestaTickets, respuestaGuardadas] = await Promise.all([
        fetch("/api/admin/support", { cache: "no-store" }),
        fetch("/api/admin/support/respuestas", { cache: "no-store" }),
      ]);
      const datos = (await respuestaTickets.json().catch(() => null)) as
        | (DatosSoporteAdmin & { error?: string })
        | null;
      const guardadas = (await respuestaGuardadas.json().catch(() => null)) as
        | { respuestas?: RespuestaGuardada[]; error?: string }
        | null;

      if (!respuestaTickets.ok || !datos) {
        throw new Error(datos?.error ?? "No se pudieron cargar las conversaciones.");
      }
      if (!respuestaGuardadas.ok) {
        throw new Error(
          guardadas?.error ?? "No se pudieron cargar las respuestas guardadas.",
        );
      }

      setTickets(datos.tickets);
      setAdmins(datos.admins);
      setYo(datos.yo);
      setTiempo(datos.tiempoMedioRespuesta);
      setResumen({
        abiertas: datos.abiertas,
        sinAsignar: datos.sinAsignar,
        mias: datos.mias,
      });
      setRespuestas(guardadas?.respuestas ?? []);
      setError(null);
    } catch (fallo) {
      const mensaje =
        fallo instanceof Error
          ? fallo.message
          : "No se pudieron cargar las conversaciones.";
      if (silencioso) toast.error(mensaje);
      else setError(mensaje);
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const seleccionada = useMemo(
    () => tickets.find((ticket) => ticket.id === ticketId) ?? null,
    [tickets, ticketId],
  );

  const visibles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (
        estado === "abiertas" &&
        ticket.status !== "open" &&
        ticket.status !== "in_progress"
      ) {
        return false;
      }
      if (estado === "resueltas" && ticket.status !== "resolved") return false;
      if (!q) return true;
      return `${ticket.subject} ${ticket.message} ${ticket.userSnapshot?.name ?? ""} ${ticket.email}`
        .toLowerCase()
        .includes(q);
    });
  }, [tickets, estado, query]);

  const conteos = useMemo(
    () => ({
      abiertas: tickets.filter(
        (ticket) =>
          ticket.status === "open" || ticket.status === "in_progress",
      ).length,
      resueltas: tickets.filter((ticket) => ticket.status === "resolved").length,
      todas: tickets.length,
    }),
    [tickets],
  );

  function cambiarFiltro(valor: FiltroEstado) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor === "abiertas") params.delete("estado");
    else params.set("estado", valor);
    const consulta = params.toString();
    router.replace(consulta ? `/admin/soporte?${consulta}` : "/admin/soporte", {
      scroll: false,
    });
  }

  function abrirTicket(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ticket", id);
    router.push(`/admin/soporte?${params.toString()}`, { scroll: false });
  }

  function volverALista() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("ticket");
    const consulta = params.toString();
    router.replace(consulta ? `/admin/soporte?${consulta}` : "/admin/soporte", {
      scroll: false,
    });
  }

  function abrirFicha(negocioId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("negocio", negocioId);
    router.push(`/admin/soporte?${params.toString()}`, { scroll: false });
  }

  async function responder(reply: string): Promise<boolean> {
    if (!seleccionada) return false;
    try {
      const respuesta = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: seleccionada.id, reply }),
      });
      const datos = (await respuesta.json().catch(() => null)) as {
        emailSent?: boolean;
        error?: string;
      } | null;
      if (!respuesta.ok) {
        throw new Error(datos?.error ?? "No se pudo responder el ticket.");
      }

      if (datos?.emailSent) {
        toast.success("Respuesta enviada al correo del usuario.");
      } else {
        toast.warning(
          "Respuesta guardada, pero el correo no pudo enviarse (SMTP sin configurar o rechazado).",
          { duration: 6000 },
        );
      }
      await cargar(true);
      return true;
    } catch (fallo) {
      toast.error(
        fallo instanceof Error ? fallo.message : "No se pudo responder el ticket.",
      );
      return false;
    }
  }

  async function cambiarEstado(status: "open" | "closed") {
    if (!seleccionada) return;
    try {
      const respuesta = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: seleccionada.id, status }),
      });
      const datos = (await respuesta.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!respuesta.ok) {
        throw new Error(datos?.error ?? "No se pudo cambiar el estado.");
      }
      toast.success(
        status === "closed" ? "Conversación cerrada." : "Conversación reabierta.",
      );
      await cargar(true);
    } catch (fallo) {
      toast.error(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo cambiar el estado.",
      );
    }
  }

  async function asignar(adminId: string | null) {
    if (!seleccionada) return;
    try {
      const respuesta = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: seleccionada.id,
          assignedAdminId: adminId,
        }),
      });
      const datos = (await respuesta.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!respuesta.ok) {
        throw new Error(datos?.error ?? "No se pudo asignar la conversación.");
      }
      const nombre =
        adminId === null
          ? "sin asignar"
          : adminId === yo?.id
            ? "a ti"
            : `a ${admins.find((admin) => admin.id === adminId)?.nombre ?? "otro admin"}`;
      toast.success(`Conversación asignada ${nombre}.`);
      await cargar(true);
    } catch (fallo) {
      toast.error(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo asignar la conversación.",
      );
    }
  }

  async function aprobar(negocioId: string): Promise<boolean> {
    try {
      const respuesta = await fetch(`/api/places/${negocioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true, reviewStatus: "approved" }),
      });
      const datos = (await respuesta.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!respuesta.ok) {
        throw new Error(datos?.error ?? "No se pudo aprobar la ficha.");
      }
      toast.success("Ficha aprobada y publicada.");
      await cargar(true);
      return true;
    } catch (fallo) {
      toast.error(
        fallo instanceof Error ? fallo.message : "No se pudo aprobar la ficha.",
      );
      return false;
    }
  }

  async function recargarRespuestas() {
    try {
      const respuesta = await fetch("/api/admin/support/respuestas", {
        cache: "no-store",
      });
      const datos = (await respuesta.json().catch(() => null)) as {
        respuestas?: RespuestaGuardada[];
        error?: string;
      } | null;
      if (!respuesta.ok) {
        throw new Error(
          datos?.error ?? "No se pudieron cargar las respuestas guardadas.",
        );
      }
      setRespuestas(datos?.respuestas ?? []);
    } catch (fallo) {
      toast.error(
        fallo instanceof Error
          ? fallo.message
          : "No se pudieron cargar las respuestas guardadas.",
      );
    }
  }

  return (
    <>
      <header className="mb-gap-md flex flex-col gap-gap-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink">
            Soporte
          </h1>
          <p className="mt-gap-xs text-small text-ink-soft/75">
            {resumen.abiertas} abiertas · {resumen.sinAsignar} sin asignar ·{" "}
            {resumen.mias} mías
          </p>
        </div>
        {tiempo && (
          <p className="inline-flex items-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-sm py-2 text-meta text-ink-soft/75">
            <Clock3 size={15} strokeWidth={1.8} className="text-verde-600" />
            Respuesta media: {duracion(tiempo.minutos)} · {tiempo.respuestas}{" "}
            {tiempo.respuestas === 1 ? "respuesta" : "respuestas"} esta semana
          </p>
        )}
      </header>

      {error && (
        <p
          role="alert"
          className="mb-gap-sm rounded-xl border border-destructive/20 bg-destructive/5 px-gap-sm py-gap-sm text-small text-destructive-ink"
        >
          {error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-gap-sm lg:h-[calc(100dvh-11rem)] lg:min-h-[520px] lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)_minmax(260px,310px)]">
        <section
          className={clsx(
            TARJETA_ADMIN,
            "flex min-h-0 flex-col p-0",
            seleccionada ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="border-b border-ink/5 p-gap-sm">
            <div className="relative">
              <Search
                size={16}
                strokeWidth={1.8}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/60"
              />
              <input
                value={query}
                onChange={(evento) => setQuery(evento.target.value)}
                placeholder="Buscar conversación…"
                aria-label="Buscar conversaciones"
                className="h-11 w-full rounded-xl border border-ink/10 bg-white pl-9 pr-3 font-lv-display text-small text-ink outline-none transition-colors focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20"
              />
            </div>
            <ControlSegmentado
              etiqueta="Filtrar conversaciones"
              valor={estado}
              onCambio={cambiarFiltro}
              opciones={FILTROS.map((valor) => ({
                valor,
                etiqueta:
                  valor === "abiertas"
                    ? "Abiertas"
                    : valor === "resueltas"
                      ? "Resueltas"
                      : "Todas",
                contador: conteos[valor],
              }))}
              className="mt-gap-sm w-full"
            />
          </div>

          <div className="scrollbar-fino min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <LoadingState label="Cargando conversaciones…" />
            ) : visibles.length === 0 ? (
              <EstadoVacioAdmin
                icono={LifeBuoy}
                titulo={query ? "Sin resultados" : "Todo al día"}
                descripcion={
                  query
                    ? "Prueba con otro nombre, asunto o correo."
                    : "Cuando un usuario reporte un problema, aparecerá aquí."
                }
              />
            ) : (
              visibles.map((ticket) => {
                const meta = ESTADO_CONVERSACION[ticket.status];
                const activa = ticket.id === ticketId;
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => abrirTicket(ticket.id)}
                    aria-current={activa ? "true" : undefined}
                    className={clsx(
                      "block w-full border-b border-ink/5 px-gap-sm py-gap-sm text-left transition-colors duration-300 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-verde-400/40",
                      activa ? "bg-verde-50" : "hover:bg-sand",
                    )}
                  >
                    <div className="flex items-start gap-gap-xs">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white font-lv-display text-meta font-bold text-verde-700">
                        {iniciales(
                          ticket.userSnapshot?.name ||
                            ticket.userSnapshot?.email ||
                            ticket.email,
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-lv-display text-small font-semibold text-ink">
                          {ticket.subject}
                        </span>
                        <span className="mt-[1px] block truncate text-meta text-ink-soft/75">
                          {ticket.userSnapshot?.name || ticket.email}
                        </span>
                        <span className="mt-gap-xs block truncate text-meta text-ink-soft/65">
                          {ticket.message}
                        </span>
                      </span>
                    </div>
                    <div className="mt-gap-xs flex flex-wrap items-center gap-[5px] pl-10">
                      <ChapitaEstado tono={meta.tono} punto={false}>
                        {meta.etiqueta}
                      </ChapitaEstado>
                      <ChapitaEstado
                        tono={ticket.assignedAdminId ? "info" : "aviso"}
                        punto={false}
                      >
                        {ticket.assignedAdminName
                          ? ticket.assignedAdminId === yo?.id
                            ? "Mía"
                            : ticket.assignedAdminName
                          : "Sin asignar"}
                      </ChapitaEstado>
                      <span className="ml-auto text-[11px] text-ink-soft/55">
                        {FECHA_HORA.format(new Date(ticket.createdAt))}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section
          className={clsx(
            "min-h-0 overflow-hidden",
            TARJETA_ADMIN,
            "p-0",
            seleccionada ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="flex min-h-0 w-full flex-col">
            <ChatSoporte
              conversacion={seleccionada}
              respuestas={respuestas}
              onVolver={volverALista}
              onResponder={responder}
              onCambiarEstado={cambiarEstado}
              onAbrirRespuestas={() => setRespuestasAbiertas(true)}
            />
          </div>
        </section>

        <aside
          className={clsx(
            "scrollbar-fino min-h-0 lg:overflow-y-auto",
            seleccionada ? "order-first lg:order-none" : "hidden lg:block",
          )}
        >
          <ContextoSoporte
            conversacion={seleccionada}
            admins={admins}
            yo={yo}
            onAsignar={asignar}
            onAbrirFicha={abrirFicha}
            onAprobar={aprobar}
          />
        </aside>
      </div>

      <RespuestasGuardadas
        abierta={respuestasAbiertas}
        onCambiarAbierta={setRespuestasAbiertas}
        respuestas={respuestas}
        onCambiar={recargarRespuestas}
      />
    </>
  );
}
