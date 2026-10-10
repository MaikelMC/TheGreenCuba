"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Check,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { prepareImage } from "@/lib/storage/compress";
import { incluye, textoBloqueo, type Plan } from "@/lib/plans";
import { ESTADO_LABEL, type EstadoPublicacion } from "@/lib/publicaciones";

/**
 * La sección «Publicaciones» del panel del negocio.
 *
 * Es la mitad del dueño de la cola de administración: aquí se redacta —con la IA
 * o a mano—, se adjunta la foto o el flyer y se envía a la cola. **Aquí no se
 * publica nada**: Facebook no deja postear en grupos por API sin arriesgar el
 * bloqueo, así que el posteo lo hace la administración a mano desde su panel, que
 * es donde está el botón de «copiar», «descargar» y «marcar publicada».
 *
 * La sección se cierra entera si el plan no incluye la función, como las ofertas
 * flash del editor: el tope en Gratis es 0, así que no hay nada que rellenar y sí
 * una frase que explica cómo se abre. El servidor lo comprueba igual.
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

interface Cola {
  semana: string;
  puede: boolean;
  tope: number | null;
  usadas: number;
  publicaciones: Publicacion[];
}

const INPUT =
  "h-11 w-full rounded-xl border border-ink/10 bg-white px-4 text-body text-ink placeholder:text-ink-soft/75 outline-none transition-colors duration-500 ease-outquint focus:border-verde-400 focus:ring-2 focus:ring-verde-400/20";

const CARD = "bg-white border border-ink/5 rounded-2xl shadow-soft";

const BOTON_PRIMARIO =
  "inline-flex h-11 cursor-pointer items-center gap-gap-xs rounded-full bg-verde-400 px-gap-lg font-lv-display text-small font-semibold text-verde-950 transition-colors duration-500 ease-outquint hover:bg-verde-300 disabled:pointer-events-none disabled:opacity-60";

const BOTON_SECUNDARIO =
  "inline-flex h-10 cursor-pointer items-center gap-[6px] rounded-full border border-ink/10 bg-white px-gap-sm font-lv-display text-meta font-semibold text-ink-soft/75 hover:border-verde-300 hover:text-verde-600 disabled:pointer-events-none disabled:opacity-50";

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

export function PublicacionesView({
  placeId,
  plan,
  onVerPlanes,
}: {
  placeId: string;
  plan: Plan;
  /** Lleva a la sección «Planes» cuando la función no entra en el plan. */
  onVerPlanes: () => void;
}) {
  const conPlan = incluye(plan, "publicaciones_fb");

  const [cola, setCola] = useState<Cola | null>(null);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [variantes, setVariantes] = useState<string[]>([]);
  const [generando, setGenerando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/business/publicaciones?placeId=${encodeURIComponent(placeId)}`,
      );
      if (!res.ok) throw new Error();
      setCola((await res.json()) as Cola);
    } catch {
      toast.error("No se pudo cargar tus publicaciones.");
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    if (!conPlan) {
      setLoading(false);
      return;
    }
    void cargar();
  }, [conPlan, cargar]);

  const llenas = cola?.tope !== null && cola !== null && cola.usadas >= (cola.tope ?? 0);

  const generar = useCallback(async () => {
    setGenerando(true);
    setVariantes([]);
    try {
      const res = await fetch("/api/business/publicaciones/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
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
  }, [placeId]);

  const subirFoto = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setSubiendo(true);
      try {
        const prepared = await prepareImage(file);
        const form = new FormData();
        form.append("file", prepared.blob, prepared.name);
        const res = await fetch(
          `/api/business/publicaciones/imagen?placeId=${encodeURIComponent(placeId)}`,
          { method: "POST", body: form },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error(body.error ?? "No se pudo subir la imagen.");
          return;
        }
        setImagenUrl(((await res.json()) as { url: string }).url);
      } catch {
        toast.error("No se pudo subir la imagen.");
      } finally {
        setSubiendo(false);
      }
    },
    [placeId],
  );

  const enviar = useCallback(async () => {
    if (!texto.trim()) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/business/publicaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId,
          texto,
          imagenUrl: imagenUrl.trim() || null,
          estado: "lista",
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(body.error ?? "No se pudo enviar la publicación.");
        return;
      }
      toast.success("Publicación en cola");
      setTexto("");
      setImagenUrl("");
      setVariantes([]);
      await cargar();
    } catch {
      toast.error("No hubo respuesta del servidor. No se guardó nada.");
    } finally {
      setGuardando(false);
    }
  }, [placeId, texto, imagenUrl, cargar]);

  const borrar = useCallback(
    async (id: string) => {
      if (!window.confirm("¿Sacar esta publicación de la cola?")) return;
      try {
        const res = await fetch(`/api/business/publicaciones/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error(body.error ?? "No se pudo eliminar.");
          return;
        }
        toast.success("Publicación eliminada");
        await cargar();
      } catch {
        toast.error("No hubo respuesta del servidor.");
      }
    },
    [cargar],
  );

  if (!conPlan) {
    return (
      <div className="flex flex-col gap-gap-md">
        <Encabezado />
        <div className={cn(CARD, "flex flex-col gap-gap-xs p-gap-md")}>
          <p className="text-small text-ink-soft/75">
            {textoBloqueo("publicaciones_fb", plan)}: redacta con IA el post de tu
            negocio, adjunta una foto o un flyer y lo dejamos listo para publicar
            en los grupos de Facebook. La administración lo publica por ti.
          </p>
          <button type="button" onClick={onVerPlanes} className={cn(BOTON_SECUNDARIO, "self-start")}>
            Ver planes
          </button>
        </div>
      </div>
    );
  }

  if (loading || !cola) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 size={24} className="animate-spin text-verde-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-gap-md">
      <Encabezado />

      <div className={cn(CARD, "flex flex-col gap-gap-md p-gap-md")}>
        <div className="flex flex-wrap items-center gap-gap-sm">
          <span className="font-lv-display text-meta font-semibold text-ink-soft/75">
            {cola.tope === null
              ? "Sin tope esta semana"
              : `${cola.usadas}/${cola.tope} esta semana`}
          </span>
          <span className="text-meta text-ink-soft/60">{cola.semana}</span>
        </div>

        {llenas && (
          <p className="rounded-xl border border-ink/10 bg-sand px-gap-md py-gap-sm text-meta text-ink-soft/70">
            Tu plan permite {cola.tope}{" "}
            {cola.tope === 1 ? "publicación" : "publicaciones"} por semana y ya
            están en cola. Puedes quitar una para liberar el sitio, o esperar a la
            semana que viene.
          </p>
        )}

        <button
          type="button"
          onClick={() => void generar()}
          disabled={generando || llenas}
          className={cn(BOTON_PRIMARIO, "self-start")}
        >
          {generando ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} strokeWidth={1.8} />
          )}
          {generando ? "Generando…" : "Generar texto con IA"}
        </button>

        {variantes.length > 0 && (
          <div className="grid gap-gap-sm md:grid-cols-2">
            {variantes.map((variante, i) => (
              <div
                key={i}
                className="flex flex-col gap-gap-sm rounded-xl border border-verde-200 bg-verde-50/50 p-gap-sm"
              >
                <p className="whitespace-pre-wrap text-small text-ink">
                  {variante}
                </p>
                <button
                  type="button"
                  onClick={() => setTexto(variante)}
                  className={cn(BOTON_SECUNDARIO, "mt-auto self-start")}
                >
                  <Check size={14} strokeWidth={2} />
                  Usar esta
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          rows={5}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className={cn(INPUT, "h-auto resize-y py-3")}
          placeholder="Escribe el texto del post, o genéralo con IA y elige una variante."
        />

        <div className="flex flex-wrap items-center gap-gap-sm">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void subirFoto(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={subiendo}
            className={BOTON_SECUNDARIO}
          >
            {subiendo ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ImagePlus size={14} strokeWidth={1.8} />
            )}
            {imagenUrl ? "Cambiar imagen" : "Añadir foto o flyer"}
          </button>
          {imagenUrl && (
            <button
              type="button"
              onClick={() => setImagenUrl("")}
              className="inline-flex items-center gap-1 font-lv-display text-meta font-semibold text-ink-soft/75 hover:text-destructive"
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

        <button
          type="button"
          onClick={() => void enviar()}
          disabled={guardando || !texto.trim() || llenas}
          className={cn(BOTON_PRIMARIO, "self-start")}
        >
          {guardando ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Check size={16} strokeWidth={2} />
          )}
          Enviar a la cola
        </button>
      </div>

      <div className={cn(CARD, "flex flex-col gap-gap-sm p-gap-md")}>
        <h2 className="font-lv-display text-small font-bold text-ink">
          En cola esta semana
        </h2>
        {cola.publicaciones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/15 bg-sand/50 p-gap-md text-small text-ink-soft/70">
            Nada en cola todavía. Redacta el post y envíalo.
          </p>
        ) : (
          cola.publicaciones.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-gap-xs rounded-xl border border-ink/5 bg-sand/30 p-gap-sm"
            >
              <div className="flex items-center gap-gap-xs">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-[10px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em]",
                    estadoBadge(p.estado),
                  )}
                >
                  {ESTADO_LABEL[p.estado]}
                </span>
                {p.estado !== "publicada" && (
                  <button
                    type="button"
                    onClick={() => void borrar(p.id)}
                    aria-label="Eliminar publicación"
                    className="ml-auto size-8 grid cursor-pointer place-items-center rounded-full border border-ink/10 text-ink-soft/60 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-small text-ink">{p.texto}</p>
              {p.imagenUrl && (
                <Image
                  src={p.imagenUrl}
                  alt="Imagen de la publicación"
                  width={240}
                  height={150}
                  className="max-h-40 w-full max-w-[240px] rounded-lg border border-ink/5 object-cover"
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Encabezado() {
  return (
    <div className="mb-gap-md">
      <h1 className="font-lv-display text-title font-bold text-ink">
        Publicaciones
      </h1>
      <p className="mt-gap-xs max-w-3xl text-small text-ink-soft/75">
        Prepara el post de tu negocio para los grupos de Facebook. La Verde{" "}
        <strong>no publica por ti</strong>: automatizar el posteo en grupos
        incumple sus términos y arriesga el bloqueo de la cuenta. Lo que envíes
        aquí llega a la administración, que lo publica a mano.
      </p>
    </div>
  );
}
