"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_LABEL, type Plan } from "@/lib/plans";
import { ESTADO_LABEL, type EstadoPublicacion } from "@/lib/publicaciones";

/**
 * La cola de publicaciones de Facebook, para administración.
 *
 * Facebook no deja publicar en grupos por API sin arriesgar el bloqueo de la
 * cuenta, así que esto **no postea nada**: prepara el texto y la imagen, y desde
 * aquí se copia el texto, se descarga el flyer y se marca la publicación con el
 * enlace del post ya hecho a mano. Los tres botones del final de cada tarjeta
 * —copiar, descargar, marcar publicada— son exactamente ese flujo.
 */

interface Publicacion {
  id: string;
  texto: string;
  imagenUrl: string | null;
  estado: EstadoPublicacion;
  semana: string;
  enlace: string | null;
  publicadaEn: number | null;
  createdAt: number;
}

interface NegocioCola {
  id: string;
  nombre: string;
  plan: Plan;
  puede: boolean;
  tope: number | null;
  usadas: number;
  enlacePerfil: string;
  publicaciones: Publicacion[];
}

const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

const CARD = "bg-white border border-ink/5 rounded-2xl shadow-soft";

function estadoBadge(estado: EstadoPublicacion): string {
  switch (estado) {
    case "publicada":
      return "bg-verde-50 text-verde-700 border-verde-200";
    case "lista":
      return "bg-sand-deep text-ink-soft border-ink/10";
    default:
      return "bg-sand text-ink-soft/75 border-ink/10";
  }
}

async function copiarTexto(texto: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success("Texto copiado");
  } catch {
    toast.error("No se pudo copiar. Selecciónalo a mano.");
  }
}

/**
 * Descarga la imagen del flyer.
 *
 * Se pide como blob y se fuerza la descarga; si el bucket no deja leer el
 * archivo desde el navegador —CORS—, el `fetch` falla y se abre en una pestaña
 * nueva, que al menos deja guardarla a mano. La descarga directa con un `<a
 * download>` no serviría: entre dominios el atributo se ignora y el enlace
 * navega en vez de descargar.
 */
async function descargarImagen(url: string): Promise<void> {
  const nombre = url.split("/").pop()?.split("?")[0] || "flyer";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Una publicación de la cola: ver, editar, publicar, borrar y copiar. */
function PublicacionCard({
  publicacion,
  onSave,
  onPublicar,
  onDelete,
}: {
  publicacion: Publicacion;
  onSave: (
    id: string,
    datos: { texto: string; imagenUrl: string | null },
  ) => Promise<boolean>;
  onPublicar: (id: string, enlace: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [modo, setModo] = useState<"ver" | "editar" | "publicar">("ver");
  const [texto, setTexto] = useState(publicacion.texto);
  const [imagen, setImagen] = useState(publicacion.imagenUrl ?? "");
  const [enlace, setEnlace] = useState(publicacion.enlace ?? "");
  const [busy, setBusy] = useState(false);

  const guardar = useCallback(async () => {
    setBusy(true);
    const ok = await onSave(publicacion.id, {
      texto,
      imagenUrl: imagen.trim() || null,
    });
    setBusy(false);
    if (ok) setModo("ver");
  }, [onSave, publicacion.id, texto, imagen]);

  const publicar = useCallback(async () => {
    setBusy(true);
    const ok = await onPublicar(publicacion.id, enlace);
    setBusy(false);
    if (ok) setModo("ver");
  }, [onPublicar, publicacion.id, enlace]);

  const borrar = useCallback(async () => {
    if (!window.confirm("¿Sacar esta publicación de la cola?")) return;
    setBusy(true);
    await onDelete(publicacion.id);
    setBusy(false);
  }, [onDelete, publicacion.id]);

  return (
    <div className={cn(CARD, "p-gap-md flex flex-col gap-gap-sm")}>
      <div className="flex items-center gap-gap-xs flex-wrap">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-[10px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em]",
            estadoBadge(publicacion.estado),
          )}
        >
          {ESTADO_LABEL[publicacion.estado]}
        </span>
        <span className="text-meta text-ink-soft/60">{publicacion.semana}</span>
        {publicacion.estado === "publicada" && publicacion.enlace && (
          <a
            href={publicacion.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-[6px] text-meta font-semibold text-verde-600 hover:text-verde-700"
          >
            <ExternalLink size={14} strokeWidth={1.8} />
            Ver post
          </a>
        )}
      </div>

      {modo === "editar" ? (
        <div className="flex flex-col gap-gap-xs">
          <textarea
            rows={5}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={cn(INPUT, "h-auto py-3 resize-y")}
            placeholder="Texto del post"
          />
          <input
            type="url"
            value={imagen}
            onChange={(e) => setImagen(e.target.value)}
            className={cn(INPUT, "cursor-text")}
            placeholder="URL del flyer (opcional)"
          />
          <div className="flex gap-gap-xs">
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={busy}
              className="inline-flex h-10 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 transition-colors duration-500 ease-outquint hover:bg-verde-300 disabled:pointer-events-none disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} strokeWidth={2} />
              )}
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setTexto(publicacion.texto);
                setImagen(publicacion.imagenUrl ?? "");
                setModo("ver");
              }}
              className="inline-flex h-10 cursor-pointer items-center gap-gap-xs rounded-full border border-ink/10 px-gap-md font-lv-display text-small font-semibold text-ink-soft/75 hover:bg-sand"
            >
              <X size={15} strokeWidth={2} />
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-body text-ink">
            {publicacion.texto}
          </p>
          {publicacion.imagenUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={publicacion.imagenUrl}
              alt="Flyer de la publicación"
              className="max-h-56 w-full max-w-sm rounded-xl border border-ink/5 object-cover"
            />
          )}
        </>
      )}

      {modo === "publicar" ? (
        <div className="flex flex-col gap-gap-xs rounded-xl border border-verde-200 bg-verde-50/60 p-gap-sm">
          <label className="font-lv-display text-meta font-semibold text-ink-soft/75">
            Enlace del post ya publicado
          </label>
          <input
            type="url"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            className={cn(INPUT, "cursor-text")}
            placeholder="https://facebook.com/groups/…/posts/…"
          />
          <div className="flex gap-gap-xs">
            <button
              type="button"
              onClick={() => void publicar()}
              disabled={busy || !enlace.trim()}
              className="inline-flex h-10 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-md font-lv-display text-small font-semibold text-verde-950 hover:bg-verde-300 disabled:pointer-events-none disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} strokeWidth={2} />
              )}
              Marcar publicada
            </button>
            <button
              type="button"
              onClick={() => setModo("ver")}
              className="inline-flex h-10 cursor-pointer items-center gap-gap-xs rounded-full border border-ink/10 px-gap-md font-lv-display text-small font-semibold text-ink-soft/75 hover:bg-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        modo === "ver" && (
          <div className="flex flex-wrap items-center gap-gap-xs">
            <button
              type="button"
              onClick={() => void copiarTexto(publicacion.texto)}
              className="inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-full border border-ink/10 px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 hover:bg-sand"
            >
              <Copy size={14} strokeWidth={1.8} />
              Copiar texto
            </button>
            {publicacion.imagenUrl && (
              <button
                type="button"
                onClick={() => void descargarImagen(publicacion.imagenUrl!)}
                className="inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-full border border-ink/10 px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 hover:bg-sand"
              >
                <Download size={14} strokeWidth={1.8} />
                Descargar imagen
              </button>
            )}
            <button
              type="button"
              onClick={() => setModo("editar")}
              className="inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-full border border-ink/10 px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 hover:bg-sand"
            >
              <Pencil size={14} strokeWidth={1.8} />
              Editar
            </button>
            {publicacion.estado !== "publicada" && (
              <button
                type="button"
                onClick={() => setModo("publicar")}
                className="inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 hover:bg-verde-300"
              >
                <Send size={14} strokeWidth={1.8} />
                Marcar publicada
              </button>
            )}
            <button
              type="button"
              onClick={() => void borrar()}
              disabled={busy}
              aria-label="Eliminar publicación"
              className="ml-auto size-9 cursor-pointer grid place-items-center rounded-full border border-ink/10 text-ink-soft/60 hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
            >
              <Trash2 size={14} strokeWidth={1.8} />
            </button>
          </div>
        )
      )}
    </div>
  );
}

export function PublicacionesQueue() {
  const [negocios, setNegocios] = useState<NegocioCola[]>([]);
  const [semana, setSemana] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [variantes, setVariantes] = useState<string[]>([]);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/publicaciones");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        semana: string;
        negocios: NegocioCola[];
      };
      setNegocios(data.negocios);
      setSemana(data.semana);
      setSelectedId((prev) =>
        prev && data.negocios.some((n) => n.id === prev)
          ? prev
          : (data.negocios[0]?.id ?? null),
      );
    } catch {
      toast.error("No se pudo cargar la cola de publicaciones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return negocios;
    return negocios.filter((n) => n.nombre.toLowerCase().includes(q));
  }, [negocios, query]);

  const seleccionado =
    negocios.find((n) => n.id === selectedId) ?? negocios[0] ?? null;

  /* Las variantes son de una sola generación: al cambiar de negocio dejan de
     tener sentido y se van, para no guardar el texto de un negocio en otro. */
  const seleccionar = useCallback((id: string) => {
    setSelectedId(id);
    setVariantes([]);
  }, []);

  const generar = useCallback(async () => {
    if (!seleccionado) return;
    setGenerando(true);
    setVariantes([]);
    try {
      const res = await fetch("/api/admin/publicaciones/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocioId: seleccionado.id }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        variantes?: string[];
        error?: string;
      };
      if (!res.ok || !body.variantes?.length) {
        toast.error(body.error ?? "No se pudo generar el texto.");
        return;
      }
      setVariantes(body.variantes);
    } catch {
      toast.error("No hubo respuesta del servidor al generar.");
    } finally {
      setGenerando(false);
    }
  }, [seleccionado]);

  const guardarVariante = useCallback(
    async (texto: string) => {
      if (!seleccionado) return;
      try {
        const res = await fetch("/api/admin/publicaciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            negocioId: seleccionado.id,
            texto,
            estado: "lista",
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error(body.error ?? "No se pudo encolar la publicación.");
          return;
        }
        toast.success("Publicación en cola");
        setVariantes([]);
        await cargar();
      } catch {
        toast.error("No hubo respuesta del servidor. No se guardó nada.");
      }
    },
    [seleccionado, cargar],
  );

  const guardarCambios = useCallback(
    async (
      id: string,
      datos: { texto: string; imagenUrl: string | null },
    ): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/publicaciones/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(datos),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error(body.error ?? "No se pudo guardar.");
          return false;
        }
        toast.success("Publicación actualizada");
        await cargar();
        return true;
      } catch {
        toast.error("No hubo respuesta del servidor. No se cambió nada.");
        return false;
      }
    },
    [cargar],
  );

  const marcarPublicada = useCallback(
    async (id: string, enlace: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/publicaciones/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: "publicada", enlace }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error(body.error ?? "No se pudo marcar como publicada.");
          return false;
        }
        toast.success("Marcada como publicada");
        await cargar();
        return true;
      } catch {
        toast.error("No hubo respuesta del servidor. No se cambió nada.");
        return false;
      }
    },
    [cargar],
  );

  const eliminar = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/publicaciones/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          toast.error("No se pudo eliminar la publicación.");
          return false;
        }
        toast.success("Publicación eliminada");
        await cargar();
        return true;
      } catch {
        toast.error("No hubo respuesta del servidor.");
        return false;
      }
    },
    [cargar],
  );

  return (
    <div className="flex flex-col gap-gap-md">
      <div className="flex flex-col gap-gap-xs">
        <h1 className="font-lv-display text-title font-bold text-ink">
          Cola de publicaciones
        </h1>
        <p className="max-w-3xl text-small text-ink-soft/75">
          Prepara el texto y el flyer de cada negocio y publícalo tú en
          Facebook. La Verde <strong>no publica por ti</strong>: automatizar el
          posteo en grupos incumple sus términos y arriesga el bloqueo de la
          cuenta. Desde aquí se copia el texto, se descarga la imagen y se marca
          la publicación con el enlace del post.
        </p>
        {semana && (
          <p className="font-lv-display text-meta font-semibold text-ink-soft/60">
            Semana en curso: {semana}
          </p>
        )}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 size={24} className="animate-spin text-verde-500" />
        </div>
      ) : negocios.length === 0 ? (
        <div className={cn(CARD, "p-gap-lg text-center")}>
          <p className="text-body text-ink-soft/75">
            Ningún negocio puede publicar todavía. La función entra en los
            planes Básico y Pro.
          </p>
        </div>
      ) : (
        <div className="grid gap-gap-md lg:grid-cols-[320px_1fr]">
          {/* Cola por negocio */}
          <div className="flex flex-col gap-gap-sm">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar negocio…"
              className={cn(INPUT, "cursor-text")}
            />
            <div className="flex flex-col gap-gap-xs max-h-[60vh] overflow-y-auto pr-1">
              {filtrados.map((n) => {
                const activo = seleccionado?.id === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => seleccionar(n.id)}
                    className={cn(
                      "flex items-center justify-between gap-gap-sm rounded-xl border p-gap-sm text-left transition-colors duration-300 ease-outquint",
                      activo
                        ? "border-verde-300 bg-verde-50"
                        : "border-ink/5 bg-white hover:bg-sand",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-lv-display text-small font-semibold text-ink">
                        {n.nombre}
                      </span>
                      <span className="text-meta text-ink-soft/65">
                        {n.puede
                          ? n.tope === null
                            ? "Sin tope"
                            : `${n.usadas}/${n.tope} esta semana`
                          : "Sin la función"}
                      </span>
                    </span>
                    {!n.puede && (
                      <span className="shrink-0 rounded-full bg-sand-deep px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft/60">
                        {PLAN_LABEL[n.plan]}
                      </span>
                    )}
                  </button>
                );
              })}
              {filtrados.length === 0 && (
                <p className="px-1 py-2 text-meta text-ink-soft/60">
                  Ningún negocio coincide.
                </p>
              )}
            </div>
          </div>

          {/* Detalle del negocio */}
          {seleccionado && (
            <div className={cn(CARD, "flex flex-col gap-gap-md p-gap-md")}>
              <div className="flex flex-wrap items-center gap-gap-sm">
                <div className="min-w-0">
                  <h2 className="truncate font-lv-display text-body font-semibold text-ink">
                    {seleccionado.nombre}
                  </h2>
                  <a
                    href={seleccionado.enlacePerfil}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-[4px] text-meta text-verde-600 hover:text-verde-700"
                  >
                    <ExternalLink size={12} strokeWidth={1.8} />
                    Ver ficha
                  </a>
                </div>
                <span className="ml-auto inline-flex items-center gap-gap-xs rounded-full border border-ink/10 px-[10px] py-[3px] font-lv-display text-meta font-semibold text-ink-soft/75">
                  {PLAN_LABEL[seleccionado.plan]}
                  {seleccionado.tope !== null &&
                    ` · ${seleccionado.usadas}/${seleccionado.tope}`}
                </span>
              </div>

              {!seleccionado.puede ? (
                <p className="rounded-xl border border-dashed border-ink/15 bg-sand/50 p-gap-md text-small text-ink-soft/70">
                  Este negocio no tiene la función «Publicaciones de Facebook».
                  Está en los planes Básico y Pro.
                </p>
              ) : (
                <>
                  {seleccionado.tope !== null &&
                    seleccionado.usadas >= seleccionado.tope && (
                      <p className="rounded-xl border border-ink/10 bg-sand px-gap-md py-gap-sm text-meta text-ink-soft/70">
                        El plan permite {seleccionado.tope}{" "}
                        {seleccionado.tope === 1
                          ? "publicación"
                          : "publicaciones"}{" "}
                        por semana y ya están en cola. Puedes editar las que
                        hay, pero no encolar más hasta la semana que viene.
                      </p>
                    )}

                  <button
                    type="button"
                    onClick={() => void generar()}
                    disabled={generando}
                    className="inline-flex h-11 cursor-pointer items-center gap-gap-xs self-start rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                  >
                    {generando ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Sparkles size={16} strokeWidth={1.8} />
                    )}
                    {generando ? "Generando…" : "Generar texto con IA"}
                  </button>

                  {variantes.length > 0 && (
                    <div className="flex flex-col gap-gap-sm">
                      <p className="font-lv-display text-meta font-semibold text-ink-soft/75">
                        Elige una variante para encolarla
                      </p>
                      <div className="grid gap-gap-sm md:grid-cols-2">
                        {variantes.map((variante, i) => (
                          <div
                            key={i}
                            className="flex flex-col gap-gap-sm rounded-xl border border-verde-200 bg-verde-50/50 p-gap-sm"
                          >
                            <p className="whitespace-pre-wrap text-small text-ink">
                              {variante}
                            </p>
                            <div className="mt-auto flex flex-wrap gap-gap-xs">
                              <button
                                type="button"
                                onClick={() => void copiarTexto(variante)}
                                className="inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 hover:bg-sand"
                              >
                                <Copy size={14} strokeWidth={1.8} />
                                Copiar
                              </button>
                              <button
                                type="button"
                                onClick={() => void guardarVariante(variante)}
                                className="inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 hover:bg-verde-300"
                              >
                                <Check size={14} strokeWidth={2} />
                                Usar esta
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="h-px bg-ink/5" />

                  <div className="flex flex-col gap-gap-sm">
                    {seleccionado.publicaciones.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-ink/15 bg-sand/50 p-gap-md text-small text-ink-soft/70">
                        Nada en cola esta semana. Genera un texto y elige una
                        variante.
                      </p>
                    ) : (
                      seleccionado.publicaciones.map((p) => (
                        <PublicacionCard
                          key={p.id}
                          publicacion={p}
                          onSave={guardarCambios}
                          onPublicar={marcarPublicada}
                          onDelete={eliminar}
                        />
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
