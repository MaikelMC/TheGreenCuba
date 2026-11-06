"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  ImagePlus,
  Loader2,
  Package,
  Pencil,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn, formatMenuPrice } from "@/lib/utils";
import { prepareImage } from "@/lib/storage/compress";
import { nombreDe, type Plan } from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";
import {
  ESTADO_LABEL,
  type EstadoPublicacion,
  type VariantePublicacion,
} from "@/lib/publicaciones";
import type { UserPlaceMenuItem } from "@/lib/places-store";

/**
 * La cola de publicaciones de Facebook, para administración.
 *
 * Facebook no deja publicar en grupos por API sin arriesgar el bloqueo de la
 * cuenta, así que esto **no postea nada**: prepara el texto y la imagen, y desde
 * aquí se copia el texto, se descarga el flyer y se marca la publicación con el
 * enlace del post ya hecho a mano.
 */

const ANGULO_LABEL: Record<VariantePublicacion["angulo"], string> = {
  directa: "Directa",
  antojo: "Antojo",
};

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

/** Perfil mínimo que devuelve /api/admin/publicaciones/perfil/[id] */
interface NegocioPerfil {
  id: string;
  name: string;
  description: string;
  menu: UserPlaceMenuItem[];
}

const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

const CARD = "bg-white border border-ink/5 rounded-2xl";

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

function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Dot de estado en el sidebar */
function SidebarDot({ n }: { n: NegocioCola }) {
  if (!n.puede) return null;
  const pendientes = n.publicaciones.filter((p) => p.estado !== "publicada").length;
  if (pendientes > 0)
    return (
      <span className="ml-auto shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-verde-400 font-lv-display text-[10px] font-bold text-verde-950 grid place-items-center">
        {pendientes}
      </span>
    );
  if (n.publicaciones.length > 0)
    return <span className="ml-auto shrink-0 size-2 rounded-full bg-ink/15 mt-0.5" />;
  return null;
}

async function copiarTexto(texto: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success("Texto copiado");
  } catch {
    toast.error("No se pudo copiar. Selecciónalo a mano.");
  }
}

function enlaceDescarga(id: string): string {
  return `/api/admin/publicaciones/${id}/imagen`;
}

/** Una publicación de la cola: ver, editar, publicar, borrar y copiar. */
function PublicacionCard({
  publicacion,
  onSave,
  onPublicar,
  onDelete,
}: {
  publicacion: Publicacion;
  onSave: (id: string, datos: { texto: string; imagenUrl: string | null }) => Promise<boolean>;
  onPublicar: (id: string, enlace: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [modo, setModo] = useState<"ver" | "editar" | "publicar" | "confirmar-borrar">("ver");
  const [texto, setTexto] = useState(publicacion.texto);
  const [imagen, setImagen] = useState(publicacion.imagenUrl ?? "");
  const [enlace, setEnlace] = useState(publicacion.enlace ?? "");
  const [busy, setBusy] = useState(false);

  const guardar = useCallback(async () => {
    setBusy(true);
    const ok = await onSave(publicacion.id, { texto, imagenUrl: imagen.trim() || null });
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
    setBusy(true);
    await onDelete(publicacion.id);
    setBusy(false);
  }, [onDelete, publicacion.id]);

  return (
    <div className={cn(CARD, "flex flex-col gap-0 overflow-hidden")}>
      <div className="flex items-center gap-gap-xs px-gap-md pt-gap-sm pb-gap-xs">
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
            className="ml-auto inline-flex items-center gap-[5px] text-meta font-semibold text-verde-600 hover:text-verde-700 transition-colors"
          >
            <ExternalLink size={13} strokeWidth={1.8} />
            Ver post
          </a>
        )}
      </div>

      <div className="px-gap-md pb-gap-sm">
        {modo === "editar" ? (
          <div className="flex flex-col gap-gap-xs">
            <textarea
              rows={5}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className={cn(INPUT, "h-auto py-3 resize-y")}
              placeholder="Texto del post"
              autoFocus
            />
            <input
              type="url"
              value={imagen}
              onChange={(e) => setImagen(e.target.value)}
              className={cn(INPUT, "cursor-text")}
              placeholder="URL del flyer (opcional)"
            />
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-body text-ink leading-relaxed">
              {publicacion.texto}
            </p>
            {publicacion.imagenUrl && (
              <div className="mt-gap-sm">
                <Image
                  src={publicacion.imagenUrl}
                  alt="Flyer de la publicación"
                  width={320}
                  height={200}
                  className="max-h-56 w-full max-w-sm rounded-xl border border-ink/5 object-cover"
                />
              </div>
            )}
          </>
        )}
      </div>

      {modo === "publicar" && (
        <div className="mx-gap-md mb-gap-sm flex flex-col gap-gap-xs rounded-xl border border-verde-200 bg-verde-50/60 p-gap-sm">
          <label className="font-lv-display text-meta font-semibold text-ink-soft/75">
            Enlace del post ya publicado
          </label>
          <input
            type="url"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            className={cn(INPUT, "cursor-text")}
            placeholder="https://facebook.com/groups/…/posts/…"
            autoFocus
          />
        </div>
      )}

      {modo === "confirmar-borrar" && (
        <div className="mx-gap-md mb-gap-sm flex items-center gap-gap-xs rounded-xl border border-destructive/20 bg-destructive/5 px-gap-sm py-gap-xs">
          <span className="text-meta text-ink-soft/75 mr-auto">¿Sacar esta publicación?</span>
          <button
            type="button"
            onClick={() => void borrar()}
            disabled={busy}
            className="inline-flex h-8 cursor-pointer items-center gap-[5px] rounded-full bg-destructive px-gap-sm font-lv-display text-meta font-semibold text-white hover:bg-destructive/90 disabled:opacity-60"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} strokeWidth={1.8} />}
            Sí, sacar
          </button>
          <button
            type="button"
            onClick={() => setModo("ver")}
            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-ink/10 px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 hover:bg-sand"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="border-t border-ink/5 px-gap-md py-gap-xs flex items-center gap-gap-xs flex-wrap">
        {modo === "editar" ? (
          <>
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={busy}
              className="inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full bg-verde-400 px-gap-md font-lv-display text-meta font-semibold text-verde-950 hover:bg-verde-300 disabled:pointer-events-none disabled:opacity-60 transition-colors"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2} />}
              Guardar
            </button>
            <button
              type="button"
              onClick={() => { setTexto(publicacion.texto); setImagen(publicacion.imagenUrl ?? ""); setModo("ver"); }}
              className="inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full border border-ink/10 px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 hover:bg-sand transition-colors"
            >
              <X size={13} strokeWidth={2} />
              Cancelar
            </button>
          </>
        ) : modo === "publicar" ? (
          <>
            <button
              type="button"
              onClick={() => void publicar()}
              disabled={busy || !enlace.trim()}
              className="inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full bg-verde-400 px-gap-md font-lv-display text-meta font-semibold text-verde-950 hover:bg-verde-300 disabled:pointer-events-none disabled:opacity-60 transition-colors"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2} />}
              Marcar publicada
            </button>
            <button
              type="button"
              onClick={() => setModo("ver")}
              className="inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full border border-ink/10 px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 hover:bg-sand transition-colors"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void copiarTexto(publicacion.texto)}
              className="inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full border border-ink/10 px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 hover:bg-sand transition-colors"
            >
              <Copy size={13} strokeWidth={1.8} />
              Copiar
            </button>
            {publicacion.imagenUrl && (
              <a
                href={enlaceDescarga(publicacion.id)}
                download
                className="inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full border border-ink/10 px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 hover:bg-sand transition-colors"
              >
                <Download size={13} strokeWidth={1.8} />
                Imagen
              </a>
            )}
            <button
              type="button"
              onClick={() => setModo("editar")}
              className="inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full border border-ink/10 px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 hover:bg-sand transition-colors"
            >
              <Pencil size={13} strokeWidth={1.8} />
              Editar
            </button>
            <div className="ml-auto flex items-center gap-gap-xs">
              {publicacion.estado !== "publicada" && (
                <button
                  type="button"
                  onClick={() => setModo("publicar")}
                  className="inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 hover:bg-verde-300 transition-colors"
                >
                  <Send size={13} strokeWidth={1.8} />
                  Publicar
                </button>
              )}
              <button
                type="button"
                onClick={() => setModo("confirmar-borrar")}
                aria-label="Eliminar publicación"
                className="size-9 cursor-pointer grid place-items-center rounded-full border border-ink/10 text-ink-soft/50 hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive transition-colors"
              >
                <Trash2 size={13} strokeWidth={1.8} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Formulario de creación manual: selector de producto + prompt + texto + imagen. */
function FormularioCreacion({
  negocioId,
  tope,
  usadas,
  onCreada,
}: {
  negocioId: string;
  tope: number | null;
  usadas: number;
  onCreada: () => Promise<void>;
}) {
  const [perfil, setPerfil] = useState<NegocioPerfil | null>(null);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);

  /* Formulario */
  const [productoId, setProductoId] = useState("");
  const [elegirAbierto, setElegirAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [prompt, setPrompt] = useState("");
  const [variantes, setVariantes] = useState<VariantePublicacion[]>([]);
  const [datosEscasos, setDatosEscasos] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [texto, setTexto] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const llenas = tope !== null && usadas >= tope;

  useEffect(() => {
    setCargandoPerfil(true);
    setPerfil(null);
    setProductoId("");
    setPrompt("");
    setVariantes([]);
    setTexto("");
    setImagenUrl("");

    fetch(`/api/admin/publicaciones/perfil/${negocioId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: NegocioPerfil) => setPerfil(data))
      .catch(() => toast.error("No se pudo cargar la ficha del negocio."))
      .finally(() => setCargandoPerfil(false));
  }, [negocioId]);

  const productos = (perfil?.menu ?? []).filter(
    (item): item is UserPlaceMenuItem & { id: string } =>
      Boolean(item.id && item.name.trim()),
  );
  const elegido = productos.find((item) => item.id === productoId);
  const termino = normalizarBusqueda(busqueda.trim());
  const coincidencias = termino
    ? productos.filter((item) => normalizarBusqueda(item.name).includes(termino))
    : productos;

  const generar = useCallback(async () => {
    setGenerando(true);
    setVariantes([]);
    try {
      const res = await fetch("/api/admin/publicaciones/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocioId,
          productoId: productoId || undefined,
          prompt: prompt.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        variantes?: VariantePublicacion[];
        datosEscasos?: boolean;
        error?: string;
      };
      if (!res.ok || !body.variantes?.length) {
        toast.error(body.error ?? "No se pudo generar el texto.");
        return;
      }
      setVariantes(body.variantes);
      setDatosEscasos(Boolean(body.datosEscasos));
    } catch {
      toast.error("No hubo respuesta del servidor al generar.");
    } finally {
      setGenerando(false);
    }
  }, [negocioId, productoId, prompt]);

  const subirFoto = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setSubiendo(true);
    try {
      const prepared = await prepareImage(file);
      const form = new FormData();
      form.append("file", prepared.blob, prepared.name);
      const res = await fetch(
        `/api/business/publicaciones/imagen?placeId=${encodeURIComponent(negocioId)}`,
        { method: "POST", body: form },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "No se pudo subir la imagen.");
        return;
      }
      setImagenUrl(((await res.json()) as { url: string }).url);
    } catch {
      toast.error("No se pudo subir la imagen.");
    } finally {
      setSubiendo(false);
    }
  }, [negocioId]);

  const encolar = useCallback(async () => {
    if (!texto.trim()) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/admin/publicaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocioId,
          texto,
          imagenUrl: imagenUrl.trim() || null,
          estado: "lista",
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "No se pudo encolar la publicación.");
        return;
      }
      toast.success("Publicación en cola");
      setTexto("");
      setImagenUrl("");
      setVariantes([]);
      setPrompt("");
      setProductoId("");
      setDatosEscasos(false);
      await onCreada();
    } catch {
      toast.error("No hubo respuesta del servidor. No se guardó nada.");
    } finally {
      setGuardando(false);
    }
  }, [negocioId, texto, imagenUrl, onCreada]);

  if (cargandoPerfil) {
    return (
      <div className="grid place-items-center py-8">
        <Loader2 size={18} className="animate-spin text-verde-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-gap-sm">
      {llenas && (
        <div className="rounded-xl border border-ink/10 bg-sand px-gap-md py-gap-sm text-meta text-ink-soft/70">
          Tope de {tope} {tope === 1 ? "publicación" : "publicaciones"} por semana alcanzado.
          Puedes editar las existentes, no encolar más.
        </div>
      )}

      {/* Selector de producto */}
      <div className="flex flex-col gap-1">
        <span className="font-lv-display text-meta font-semibold text-ink-soft/60 uppercase tracking-[0.08em]">
          Producto a destacar
        </span>
        <button
          type="button"
          onClick={() => setElegirAbierto(true)}
          className="group flex w-full cursor-pointer items-center gap-gap-sm rounded-xl border border-ink/10 bg-sand/40 px-gap-sm py-[10px] text-left transition-colors duration-300 hover:border-verde-300 hover:bg-verde-50/40"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-ink/5 bg-white text-verde-600">
            <Package size={16} strokeWidth={1.7} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-lv-display text-small font-semibold text-ink">
              {elegido ? elegido.name : "Sin producto concreto"}
            </span>
            <span className="block truncate text-meta text-ink-soft/60">
              {elegido
                ? elegido.price?.trim()
                  ? formatMenuPrice(elegido.price, elegido.currency || "MLC")
                  : "Toca para cambiar"
                : productos.length
                  ? `${productos.length} ${productos.length === 1 ? "producto" : "productos"} en la carta`
                  : "Carta vacía"}
            </span>
          </span>
          <ChevronRight size={15} strokeWidth={1.8} className="shrink-0 text-ink-soft/40 transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Sheet selector */}
      <Sheet open={elegirAbierto} onOpenChange={(open) => { setElegirAbierto(open); if (!open) setBusqueda(""); }}>
        <SheetContent side="bottom" className="mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl border-ink/5 p-gap-md">
          <SheetHeader>
            <SheetTitle className="text-left">Elige un producto</SheetTitle>
            <SheetDescription className="text-left">
              Centra la publicación en uno de la carta.
            </SheetDescription>
          </SheetHeader>
          <div className="relative mt-gap-sm shrink-0">
            <Search size={15} strokeWidth={1.8} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft/50" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en la carta…"
              className={cn(INPUT, "pl-10")}
            />
          </div>
          <div className="mt-gap-md flex shrink-0 items-center justify-between px-1">
            <span className="font-lv-display text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft/60">
              {termino ? "Resultados" : "Carta"}
            </span>
            <span className="text-meta text-ink-soft/50">
              {coincidencias.length} {coincidencias.length === 1 ? "producto" : "productos"}
            </span>
          </div>
          <div className="mt-2 flex flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pb-gap-sm">
            {!termino && (
              <button
                type="button"
                onClick={() => { setProductoId(""); setElegirAbierto(false); setBusqueda(""); }}
                aria-pressed={!productoId}
                className={cn(
                  "flex w-full touch-manipulation cursor-pointer items-center gap-gap-sm rounded-2xl border p-2.5 text-left transition duration-300",
                  productoId
                    ? "border-ink/5 bg-white hover:border-verde-200 hover:bg-verde-50/40"
                    : "border-verde-300 bg-verde-50/60",
                )}
              >
                <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-ink/5 bg-sand-deep text-ink-soft/50">
                  <X size={20} strokeWidth={1.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-lv-display text-small font-semibold text-ink">Sin producto concreto</span>
                  <span className="mt-0.5 block truncate text-meta text-ink-soft/70">La IA elige entre la carta</span>
                </span>
                {!productoId && (
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-verde-400 text-verde-950">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            )}
            {coincidencias.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-sand text-ink-soft/50">
                  <Search size={20} strokeWidth={1.6} />
                </span>
                <p className="text-small font-semibold text-ink">Nada por aquí</p>
                <p className="text-meta text-ink-soft/70">Prueba con otra palabra.</p>
              </div>
            ) : (
              coincidencias.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setProductoId(item.id); setElegirAbierto(false); setBusqueda(""); }}
                  aria-pressed={item.id === productoId}
                  className={cn(
                    "flex w-full touch-manipulation cursor-pointer items-center gap-gap-sm rounded-2xl border p-2.5 text-left transition duration-300",
                    item.id === productoId
                      ? "border-verde-300 bg-verde-50/60"
                      : "border-ink/5 bg-white hover:border-verde-200 hover:bg-verde-50/40",
                  )}
                >
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-ink/5 bg-sand-deep">
                    {item.image ? (
                      <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-ink-soft/40">
                        <Package size={20} strokeWidth={1.6} />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-lv-display text-small font-semibold text-ink">{item.name}</span>
                      {item.tag?.trim() && (
                        <span className="shrink-0 rounded-full bg-verde-400/15 px-2 py-[1px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.08em] text-verde-700">
                          {item.tag}
                        </span>
                      )}
                    </span>
                    {item.description?.trim() && (
                      <span className="mt-0.5 block truncate text-meta text-ink-soft/70">{item.description}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {item.price?.trim() && (
                      <span className="rounded-full border border-ink/10 bg-white px-2.5 py-[3px] font-lv-display text-meta font-semibold text-ink">
                        {formatMenuPrice(item.price, item.currency || "MLC")}
                      </span>
                    )}
                    {item.id === productoId && (
                      <span className="grid size-5 place-items-center rounded-full bg-verde-400 text-verde-950">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Prompt */}
      <div className="flex flex-col gap-1">
        <span className="font-lv-display text-meta font-semibold text-ink-soft/60 uppercase tracking-[0.08em]">
          Instrucción para la IA
        </span>
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={cn(INPUT, "h-auto resize-y py-3")}
          placeholder="Qué quieres contar, el tono, la oferta, el producto… (opcional)"
        />
      </div>

      {/* Botón generar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void generar()}
          disabled={generando || llenas}
          className="inline-flex h-10 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 shadow-primary-halo transition duration-300 hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
        >
          {generando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} strokeWidth={1.8} />}
          {generando ? "Generando…" : "Generar con IA"}
        </button>
      </div>

      {datosEscasos && (
        <p className="rounded-lg border border-ink/10 bg-sand/60 px-gap-sm py-2 text-meta text-ink-soft/70">
          La ficha tiene pocos datos. El texto puede ser genérico.
        </p>
      )}

      {/* Variantes */}
      {variantes.length > 0 && (
        <div className="grid gap-gap-sm md:grid-cols-2">
          {variantes.map((variante, i) => (
            <div key={i} className="flex flex-col gap-gap-sm rounded-xl border border-verde-200 bg-verde-50/40 p-gap-sm">
              <span className="inline-flex w-fit items-center rounded-full border border-verde-200 bg-white px-[9px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-verde-700">
                {ANGULO_LABEL[variante.angulo]}
              </span>
              <p className="whitespace-pre-wrap text-small text-ink leading-relaxed flex-1">
                {variante.texto}
              </p>
              <div className="flex gap-gap-xs pt-gap-xs border-t border-verde-200/60">
                <button
                  type="button"
                  onClick={() => void copiarTexto(variante.texto)}
                  className="inline-flex h-8 cursor-pointer items-center gap-[5px] rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 hover:bg-sand transition-colors"
                >
                  <Copy size={13} strokeWidth={1.8} />
                  Copiar
                </button>
                <button
                  type="button"
                  onClick={() => setTexto(variante.texto)}
                  className="inline-flex h-8 cursor-pointer items-center gap-[5px] rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 hover:bg-verde-300 transition-colors"
                >
                  <Check size={13} strokeWidth={2} />
                  Usar esta
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Texto del post */}
      <div className="flex flex-col gap-1">
        <span className="font-lv-display text-meta font-semibold text-ink-soft/60 uppercase tracking-[0.08em]">
          Texto del post
        </span>
        <textarea
          rows={5}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className={cn(INPUT, "h-auto resize-y py-3")}
          placeholder="Elige una variante o escríbelo a mano."
        />
      </div>

      {/* Imagen */}
      <div className="flex flex-wrap items-center gap-gap-sm">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void subirFoto(f); }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={subiendo}
          className="inline-flex h-9 cursor-pointer items-center gap-[5px] rounded-full border border-ink/10 px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 hover:bg-sand disabled:opacity-60 transition-colors"
        >
          {subiendo ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} strokeWidth={1.8} />}
          {imagenUrl ? "Cambiar imagen" : "Añadir foto o flyer"}
        </button>
        {imagenUrl && (
          <button
            type="button"
            onClick={() => setImagenUrl("")}
            className="inline-flex items-center gap-1 font-lv-display text-meta font-semibold text-ink-soft/75 hover:text-destructive transition-colors"
          >
            <X size={13} strokeWidth={1.8} />
            Quitar
          </button>
        )}
      </div>
      {imagenUrl && (
        <Image
          src={imagenUrl}
          alt="Imagen de la publicación"
          width={320}
          height={200}
          className="max-h-56 w-full max-w-sm rounded-xl border border-ink/5 object-cover"
        />
      )}

      {/* Encolar */}
      <button
        type="button"
        onClick={() => void encolar()}
        disabled={guardando || !texto.trim() || llenas}
        className="inline-flex h-10 cursor-pointer items-center gap-gap-xs self-start rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 transition duration-300 hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
      >
        {guardando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={2} />}
        Enviar a la cola
      </button>
    </div>
  );
}

export function PublicacionesQueue() {
  const cat = useCatalogo();
  const [negocios, setNegocios] = useState<NegocioCola[]>([]);
  const [semana, setSemana] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetalle, setMobileDetalle] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/publicaciones");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { semana: string; negocios: NegocioCola[] };
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

  useEffect(() => { void cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return negocios;
    return negocios.filter((n) => n.nombre.toLowerCase().includes(q));
  }, [negocios, query]);

  const seleccionado = negocios.find((n) => n.id === selectedId) ?? negocios[0] ?? null;

  const seleccionar = useCallback((id: string) => {
    setSelectedId(id);
    setMobileDetalle(true);
  }, []);

  const guardarCambios = useCallback(
    async (id: string, datos: { texto: string; imagenUrl: string | null }): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/publicaciones/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(datos),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
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
          const body = (await res.json().catch(() => ({}))) as { error?: string };
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
        const res = await fetch(`/api/admin/publicaciones/${id}`, { method: "DELETE" });
        if (!res.ok) { toast.error("No se pudo eliminar la publicación."); return false; }
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
      <div className="flex items-center gap-gap-sm">
        <h1 className="font-lv-display text-title font-bold text-ink">Cola de publicaciones</h1>
        {semana && (
          <span className="font-lv-display text-meta font-semibold text-ink-soft/50">· {semana}</span>
        )}
      </div>

      {loading ? (
        <div className="grid place-items-center py-24">
          <Loader2 size={22} className="animate-spin text-verde-400" />
        </div>
      ) : negocios.length === 0 ? (
        <div className={cn(CARD, "p-gap-lg text-center max-w-md")}>
          <p className="text-body text-ink-soft/70">
            Ningún negocio puede publicar todavía. La función entra con el módulo Facebook o con Publicidad Max.
          </p>
        </div>
      ) : (
        <div className="grid gap-gap-md lg:grid-cols-[300px_1fr]">

          {/* Sidebar */}
          <div className={cn("flex flex-col gap-gap-sm", mobileDetalle && selectedId ? "hidden lg:flex" : "flex")}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar negocio…"
              className={cn(INPUT, "cursor-text")}
            />
            <div className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5">
              {filtrados.map((n) => {
                const activo = seleccionado?.id === n.id;
                const totalPubs = n.publicaciones.length;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => seleccionar(n.id)}
                    className={cn(
                      "group flex items-center gap-gap-sm rounded-xl border px-gap-sm py-[10px] text-left transition-colors duration-200",
                      activo ? "border-verde-300 bg-verde-50" : "border-ink/5 bg-white hover:bg-sand/60",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-lv-display text-small font-semibold text-ink leading-tight">
                        {n.nombre}
                      </span>
                      <span className="text-meta text-ink-soft/60 leading-tight">
                        {!n.puede
                          ? "Sin la función"
                          : totalPubs === 0
                          ? "Sin publicaciones"
                          : n.tope === null
                          ? `${totalPubs} en cola`
                          : `${n.usadas}/${n.tope} · ${totalPubs} en cola`}
                      </span>
                    </span>
                    <SidebarDot n={n} />
                    {!n.puede && (
                      <span className="shrink-0 rounded-full bg-sand-deep px-[7px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-soft/60">
                        {nombreDe(n.plan, cat)}
                      </span>
                    )}
                  </button>
                );
              })}
              {filtrados.length === 0 && (
                <p className="px-2 py-3 text-meta text-ink-soft/60">Ningún negocio coincide.</p>
              )}
            </div>
          </div>

          {/* Panel de detalle */}
          {seleccionado && (
            <div className={cn("flex flex-col gap-gap-md min-w-0", !mobileDetalle ? "hidden lg:flex" : "flex")}>

              {/* Header sticky */}
              <div className={cn(CARD, "flex flex-wrap items-center gap-gap-sm px-gap-md py-gap-sm sticky top-4 z-10")}>
                <button
                  type="button"
                  onClick={() => setMobileDetalle(false)}
                  className="lg:hidden inline-flex items-center justify-center size-8 rounded-full border border-ink/10 text-ink-soft/60 hover:bg-sand cursor-pointer transition-colors"
                  aria-label="Volver a la lista"
                >
                  <ArrowLeft size={15} strokeWidth={1.8} />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-lv-display text-body font-semibold text-ink leading-tight">
                    {seleccionado.nombre}
                  </h2>
                  <a
                    href={seleccionado.enlacePerfil}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-[4px] text-meta text-verde-600 hover:text-verde-700 transition-colors"
                  >
                    <ExternalLink size={11} strokeWidth={1.8} />
                    Ver ficha
                  </a>
                </div>
                <div className="flex items-center gap-gap-xs">
                  <span className="inline-flex items-center gap-gap-xs rounded-full border border-ink/10 px-[10px] py-[3px] font-lv-display text-meta font-semibold text-ink-soft/70">
                    {nombreDe(seleccionado.plan, cat)}
                  </span>
                  {seleccionado.tope !== null && (
                    <span className="font-lv-display text-meta text-ink-soft/50">
                      {seleccionado.usadas}/{seleccionado.tope}
                    </span>
                  )}
                </div>
              </div>

              {!seleccionado.puede ? (
                <div className={cn(CARD, "p-gap-md")}>
                  <p className="text-small text-ink-soft/70">
                    Este negocio no tiene la función «Publicaciones de Facebook».
                    Entra con el módulo Facebook o con Publicidad Max.
                  </p>
                </div>
              ) : (
                <>
                  {/* Formulario de creación manual */}
                  <div className={cn(CARD, "p-gap-md")}>
                    <p className="font-lv-display text-small font-semibold text-ink mb-gap-sm">
                      Crear publicación
                    </p>
                    <FormularioCreacion
                      negocioId={seleccionado.id}
                      tope={seleccionado.tope}
                      usadas={seleccionado.usadas}
                      onCreada={cargar}
                    />
                  </div>

                  {/* Cola de publicaciones */}
                  <div className="flex flex-col gap-gap-sm">
                    <p className="font-lv-display text-meta font-semibold text-ink-soft/50 uppercase tracking-[0.08em] px-1">
                      En cola esta semana · {seleccionado.publicaciones.length}
                    </p>
                    {seleccionado.publicaciones.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-ink/15 bg-sand/40 p-gap-md text-center">
                        <p className="text-small text-ink-soft/60">
                          Nada en cola todavía. Usa el formulario de arriba.
                        </p>
                      </div>
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
