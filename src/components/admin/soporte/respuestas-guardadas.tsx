"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { RespuestaGuardada } from "@/lib/admin-soporte";
import { HojaAdmin } from "@/components/admin/ui/hoja";
import { BotonAdmin, BotonIconoAdmin } from "@/components/admin/ui/botones";

const CAMPO =
  "w-full rounded-xl border border-ink/10 bg-white px-3 text-small text-ink outline-none transition-colors duration-300 placeholder:text-ink-soft/45 focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

/**
 * Las respuestas guardadas se editan en una hoja para no meter un formulario
 * permanente dentro del contexto de la conversación. Al guardar, quien usa la
 * hoja recarga la lista y el compositor recibe el texto nuevo.
 */
export function RespuestasGuardadas({
  abierta,
  onCambiarAbierta,
  respuestas,
  onCambiar,
}: {
  abierta: boolean;
  onCambiarAbierta: (abierta: boolean) => void;
  respuestas: RespuestaGuardada[];
  onCambiar: () => Promise<void>;
}) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState<RespuestaGuardada | null>(null);
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  useEffect(() => {
    if (!abierta) {
      setMostrarFormulario(false);
      setEditando(null);
      setConfirmando(null);
    }
  }, [abierta]);

  function nueva() {
    setEditando(null);
    setTitulo("");
    setCuerpo("");
    setMostrarFormulario(true);
  }

  function editar(respuesta: RespuestaGuardada) {
    setEditando(respuesta);
    setTitulo(respuesta.title);
    setCuerpo(respuesta.body);
    setMostrarFormulario(true);
  }

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;

    setGuardando(true);
    try {
      const respuesta = await fetch("/api/admin/support/respuestas", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editando ? { id: editando.id } : {}),
          titulo,
          cuerpo,
        }),
      });
      const datos = (await respuesta.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!respuesta.ok) {
        throw new Error(datos?.error ?? "No se pudo guardar la respuesta.");
      }

      toast.success(
        editando ? "Respuesta guardada actualizada." : "Respuesta guardada creada.",
      );
      await onCambiar();
      setMostrarFormulario(false);
      setEditando(null);
      setTitulo("");
      setCuerpo("");
    } catch (fallo) {
      toast.error(
        fallo instanceof Error ? fallo.message : "No se pudo guardar la respuesta.",
      );
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    if (confirmando !== id) {
      setConfirmando(id);
      return;
    }

    setBorrando(id);
    try {
      const respuesta = await fetch("/api/admin/support/respuestas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const datos = (await respuesta.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!respuesta.ok) {
        throw new Error(datos?.error ?? "No se pudo eliminar la respuesta.");
      }
      toast.success("Respuesta guardada eliminada.");
      setConfirmando(null);
      await onCambiar();
    } catch (fallo) {
      toast.error(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo eliminar la respuesta.",
      );
    } finally {
      setBorrando(null);
    }
  }

  return (
    <HojaAdmin
      open={abierta}
      onOpenChange={onCambiarAbierta}
      titulo="Respuestas guardadas"
      descripcion="Textos reutilizables para contestar sin escribirlos de nuevo."
    >
      <div className="flex items-center justify-between gap-gap-sm">
        <p className="text-small text-ink-soft/75">
          {respuestas.length === 1
            ? "1 respuesta disponible"
            : `${respuestas.length} respuestas disponibles`}
        </p>
        <BotonAdmin tamano="pequeno" onClick={nueva} variante="primario">
          <Plus size={15} strokeWidth={2} />
          Nueva
        </BotonAdmin>
      </div>

      {mostrarFormulario && (
        <form
          onSubmit={(evento) => void guardar(evento)}
          className="flex flex-col gap-gap-sm rounded-2xl border border-ink/10 bg-sand p-gap-sm"
        >
          <div>
            <label
              htmlFor="respuesta-titulo"
              className="mb-[6px] block font-lv-display text-meta font-semibold text-ink"
            >
              Título
            </label>
            <input
              id="respuesta-titulo"
              value={titulo}
              onChange={(evento) => setTitulo(evento.target.value)}
              maxLength={80}
              required
              placeholder="Ej.: Cómo cambiar el horario"
              className={`${CAMPO} h-11`}
            />
          </div>
          <div>
            <label
              htmlFor="respuesta-cuerpo"
              className="mb-[6px] block font-lv-display text-meta font-semibold text-ink"
            >
              Texto
            </label>
            <textarea
              id="respuesta-cuerpo"
              value={cuerpo}
              onChange={(evento) => setCuerpo(evento.target.value)}
              rows={5}
              maxLength={1200}
              required
              placeholder="Escribe la respuesta completa…"
              className={`${CAMPO} min-h-[120px] resize-y py-3`}
            />
          </div>
          <div className="flex justify-end gap-gap-xs">
            <BotonAdmin
              tamano="pequeno"
              onClick={() => {
                setMostrarFormulario(false);
                setEditando(null);
              }}
              disabled={guardando}
            >
              Cancelar
            </BotonAdmin>
            <BotonAdmin
              type="submit"
              tamano="pequeno"
              variante="primario"
              disabled={guardando}
            >
              {guardando ? "Guardando…" : "Guardar"}
            </BotonAdmin>
          </div>
        </form>
      )}

      {respuestas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/10 px-gap-sm py-gap-md text-center text-small text-ink-soft/70">
          Todavía no hay respuestas guardadas. Crea la primera para reutilizarla
          en las conversaciones.
        </p>
      ) : (
        <div className="flex flex-col gap-gap-xs">
          {respuestas.map((respuesta) => (
            <article
              key={respuesta.id}
              className="rounded-xl border border-ink/10 bg-white p-gap-sm"
            >
              <div className="flex items-start justify-between gap-gap-sm">
                <p className="min-w-0 font-lv-display text-small font-semibold text-ink">
                  {respuesta.title}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <BotonIconoAdmin
                    aria-label={`Editar ${respuesta.title}`}
                    onClick={() => editar(respuesta)}
                    className="size-9"
                  >
                    <Pencil size={15} strokeWidth={1.8} />
                  </BotonIconoAdmin>
                  {confirmando === respuesta.id ? (
                    <>
                      <BotonIconoAdmin
                        aria-label="Confirmar eliminación"
                        onClick={() => void eliminar(respuesta.id)}
                        disabled={borrando === respuesta.id}
                        className="size-9 text-destructive-ink"
                      >
                        <Check size={16} strokeWidth={2} />
                      </BotonIconoAdmin>
                      <BotonIconoAdmin
                        aria-label="Cancelar eliminación"
                        onClick={() => setConfirmando(null)}
                        className="size-9"
                      >
                        <X size={16} strokeWidth={2} />
                      </BotonIconoAdmin>
                    </>
                  ) : (
                    <BotonIconoAdmin
                      aria-label={`Eliminar ${respuesta.title}`}
                      onClick={() => void eliminar(respuesta.id)}
                      className="size-9"
                    >
                      <Trash2 size={15} strokeWidth={1.8} />
                    </BotonIconoAdmin>
                  )}
                </div>
              </div>
              <p className="mt-gap-xs whitespace-pre-wrap text-small text-ink-soft/80">
                {respuesta.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </HojaAdmin>
  );
}
