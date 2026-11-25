"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Clock3,
  Loader2,
  MessageSquare,
  Send,
  Settings2,
} from "lucide-react";
import type {
  ConversacionSoporte,
  RespuestaGuardada,
} from "@/lib/admin-soporte";
import { BotonAdmin, BotonIconoAdmin } from "@/components/admin/ui/botones";
import { ChapitaEstado } from "@/components/admin/ui/chapita";
import { EstadoVacioAdmin } from "@/components/admin/ui/tarjeta";
import { ESTADO_CONVERSACION, FECHA_HORA, iniciales } from "./comun";

const CAMPO =
  "w-full rounded-xl border border-ink/10 bg-white px-3 text-small text-ink outline-none transition-colors duration-300 placeholder:text-ink-soft/45 focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

export function ChatSoporte({
  conversacion,
  respuestas,
  onVolver,
  onResponder,
  onCambiarEstado,
  onAbrirRespuestas,
}: {
  conversacion: ConversacionSoporte | null;
  respuestas: RespuestaGuardada[];
  onVolver: () => void;
  onResponder: (reply: string) => Promise<boolean>;
  onCambiarEstado: (status: "open" | "closed") => Promise<void>;
  onAbrirRespuestas: () => void;
}) {
  const [respuesta, setRespuesta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  useEffect(() => {
    setRespuesta("");
    setEnviando(false);
    setCambiandoEstado(false);
  }, [conversacion?.id]);

  if (!conversacion) {
    return (
      <div className="grid h-full place-items-center">
        <EstadoVacioAdmin
          icono={MessageSquare}
          titulo="Elige una conversación"
          descripcion="Selecciona un ticket de la lista para leerlo y responderlo."
        />
      </div>
    );
  }

  const estado = ESTADO_CONVERSACION[conversacion.status];
  const nombre =
    conversacion.userSnapshot?.name ||
    conversacion.userSnapshot?.email ||
    conversacion.email;
  const cerrada = conversacion.status === "closed";

  async function enviar() {
    if (!conversacion || respuesta.trim().length === 0 || enviando) return;
    setEnviando(true);
    try {
      const enviada = await onResponder(respuesta.trim());
      if (enviada) setRespuesta("");
    } finally {
      setEnviando(false);
    }
  }

  async function alternarCierre() {
    if (cambiandoEstado) return;
    setCambiandoEstado(true);
    try {
      await onCambiarEstado(cerrada ? "open" : "closed");
    } finally {
      setCambiandoEstado(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-gap-sm border-b border-ink/5 p-gap-sm sm:p-gap-md">
        <BotonIconoAdmin
          aria-label="Volver a la lista de conversaciones"
          onClick={onVolver}
          className="lg:hidden"
        >
          <ArrowLeft size={19} strokeWidth={1.8} />
        </BotonIconoAdmin>

        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-verde-50 font-lv-display text-small font-bold text-verde-700">
          {iniciales(nombre)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-lv-display text-body font-semibold text-ink">
            {nombre}
          </p>
          <p className="truncate text-meta text-ink-soft/75">
            {conversacion.subject}
          </p>
        </div>

        <div className="flex items-center gap-gap-xs">
          <ChapitaEstado tono={estado.tono}>{estado.etiqueta}</ChapitaEstado>
          <BotonAdmin
            tamano="pequeno"
            onClick={() => void alternarCierre()}
            disabled={cambiandoEstado}
          >
            {cambiandoEstado && <Loader2 size={14} className="animate-spin" />}
            {cerrada ? "Reabrir" : "Cerrar"}
          </BotonAdmin>
        </div>
      </header>

      <div className="scrollbar-fino flex min-h-0 flex-1 flex-col gap-gap-md overflow-y-auto p-gap-sm sm:p-gap-md">
        <div className="flex items-start gap-gap-xs">
          <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-sand-deep text-meta font-bold text-ink-soft/75">
            {iniciales(nombre)}
          </span>
          <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tl-md border border-ink/5 bg-sand px-gap-sm py-gap-sm">
            <p className="whitespace-pre-wrap text-small text-ink">
              {conversacion.message}
            </p>
            <p className="mt-gap-xs text-[11px] text-ink-soft/55">
              {FECHA_HORA.format(new Date(conversacion.createdAt))}
            </p>
          </div>
        </div>

        {conversacion.adminReply ? (
          <div className="flex items-start justify-end gap-gap-xs">
            <div className="min-w-0 max-w-[85%] rounded-2xl rounded-tr-md border border-verde-200 bg-verde-50 px-gap-sm py-gap-sm">
              <p className="whitespace-pre-wrap text-small text-verde-950">
                {conversacion.adminReply}
              </p>
              {conversacion.repliedAt && (
                <p className="mt-gap-xs text-[11px] text-verde-700/70">
                  {FECHA_HORA.format(new Date(conversacion.repliedAt))}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-gap-xs rounded-xl border border-dashed border-ink/10 px-gap-sm py-gap-sm text-meta text-ink-soft/65">
            <Clock3 size={15} strokeWidth={1.8} />
            Sin respuesta todavía.
          </div>
        )}
      </div>

      <div className="border-t border-ink/5 p-gap-sm sm:p-gap-md">
        <div className="mb-gap-xs flex flex-wrap items-center gap-gap-xs">
          {respuestas.length > 0 && (
            <select
              value=""
              onChange={(evento) => {
                const elegida = respuestas.find(
                  (item) => item.id === evento.target.value,
                );
                if (elegida) setRespuesta(elegida.body);
              }}
              className={`${CAMPO} h-10 max-w-[230px] cursor-pointer`}
              aria-label="Usar una respuesta guardada"
            >
              <option value="">Usar respuesta guardada…</option>
              {respuestas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          )}
          <BotonAdmin tamano="pequeno" onClick={onAbrirRespuestas}>
            <Settings2 size={14} strokeWidth={1.8} />
            Respuestas guardadas
          </BotonAdmin>
        </div>

        <textarea
          value={respuesta}
          onChange={(evento) => setRespuesta(evento.target.value)}
          rows={3}
          maxLength={3000}
          placeholder="Escribe la respuesta para el usuario…"
          aria-label="Respuesta al ticket"
          className={`${CAMPO} min-h-[92px] resize-y py-3`}
        />

        <div className="mt-gap-xs flex items-center justify-between gap-gap-sm">
          <p className="text-meta text-ink-soft/60">
            Se envía por correo a {conversacion.email}.
          </p>
          <BotonAdmin
            variante="primario"
            onClick={() => void enviar()}
            disabled={enviando || respuesta.trim().length === 0}
          >
            {enviando ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} strokeWidth={1.8} />
            )}
            {enviando ? "Enviando…" : "Enviar y resolver"}
          </BotonAdmin>
        </div>
      </div>
    </div>
  );
}
