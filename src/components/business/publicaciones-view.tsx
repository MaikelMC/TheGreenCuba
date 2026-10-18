"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Check,
  ChevronRight,
  ImagePlus,
  Loader2,
  Package,
  Search,
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
import { textoBloqueo, type Funcion } from "@/lib/plans";
import { useCatalogo } from "@/providers/catalogo-provider";
import {
  ESTADO_LABEL,
  type EstadoPublicacion,
  type VariantePublicacion,
} from "@/lib/publicaciones";
import type { UserPlaceMenuItem } from "@/lib/places-store";

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

const CARD = "bg-white border border-ink/5 rounded-2xl";

const ANGULO_LABEL: Record<VariantePublicacion["angulo"], string> = {
  directa: "Directa",
  antojo: "Antojo",
};

/** Para que «cafe» encuentre «Café» al buscar en la carta. */
function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

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
  productos: menu,
  funciones,
  onVerPlanes,
}: {
  placeId: string;
  /** La carta del negocio, tal como la tiene el panel: es de donde se elige. */
  productos: UserPlaceMenuItem[];
  /** Todo lo que puede hacer el negocio, resuelto en el servidor. */
  funciones: Funcion[];
  /** Lleva a la sección «Planes» cuando la función no entra. */
  onVerPlanes: () => void;
}) {
  const conPlan = funciones.includes("publicaciones_fb");

  const cat = useCatalogo();
  /* Solo entran los productos con id: es lo que la API usa para señalarlos. La
     carta llega de la ficha que ya tiene el panel, sin otro viaje. */
  const productos = menu.filter(
    (item): item is UserPlaceMenuItem & { id: string } =>
      Boolean(item.id && item.name.trim()),
  );
  const [cola, setCola] = useState<Cola | null>(null);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [productoId, setProductoId] = useState("");
  const [elegirAbierto, setElegirAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [prompt, setPrompt] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [variantes, setVariantes] = useState<VariantePublicacion[]>([]);
  const [datosEscasos, setDatosEscasos] = useState(false);
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

  const llenas =
    cola?.tope !== null && cola !== null && cola.usadas >= (cola.tope ?? 0);

  const elegido = productos.find((item) => item.id === productoId);
  const termino = normalizarBusqueda(busqueda.trim());
  const coincidencias = termino
    ? productos.filter((item) =>
        normalizarBusqueda(item.name).includes(termino),
      )
    : productos;

  const elegirProducto = (id: string) => {
    setProductoId(id);
    setElegirAbierto(false);
    setBusqueda("");
  };

  const generar = useCallback(async () => {
    setGenerando(true);
    setVariantes([]);
    try {
      const res = await fetch("/api/business/publicaciones/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId,
          prompt: prompt.trim() || undefined,
          productoId: productoId || undefined,
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
  }, [placeId, prompt, productoId]);

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
      setDatosEscasos(false);
      setPrompt("");
      setProductoId("");
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
            {textoBloqueo("publicaciones_fb", cat)}: redacta con IA el post de
            tu negocio, adjunta una foto o un flyer y lo dejamos listo para
            publicar en los grupos de Facebook. La administración lo publica por
            ti.
          </p>
          <button
            type="button"
            onClick={onVerPlanes}
            className={cn(BOTON_SECUNDARIO, "self-start")}
          >
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
            están en cola. Puedes quitar una para liberar el sitio, o esperar a
            la semana que viene.
          </p>
        )}

        <div className="flex flex-col gap-gap-xs">
          <span className="font-lv-display text-meta font-semibold text-ink-soft/75">
            Producto del catálogo
          </span>
          <button
            type="button"
            onClick={() => setElegirAbierto(true)}
            className="group flex w-full cursor-pointer items-center gap-gap-sm rounded-2xl border border-ink/10 bg-sand/40 p-gap-sm text-left transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50/40"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-ink/5 bg-white text-verde-600">
              <Package size={19} strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-lv-display text-small font-semibold text-ink">
                {elegido ? elegido.name : "Sin producto concreto"}
              </span>
              <span className="block truncate text-meta text-ink-soft/70">
                {elegido
                  ? elegido.price?.trim()
                    ? formatMenuPrice(elegido.price, elegido.currency || "MLC")
                    : "Toca para cambiar"
                  : productos.length
                    ? `${productos.length} ${productos.length === 1 ? "producto" : "productos"} en tu carta`
                    : "Tu carta está vacía"}
              </span>
            </span>
            <ChevronRight
              size={16}
              strokeWidth={1.8}
              className="shrink-0 text-ink-soft/50 transition-transform duration-500 ease-outquint group-hover:translate-x-0.5"
            />
          </button>
        </div>

        <Sheet
          open={elegirAbierto}
          onOpenChange={(abierto) => {
            setElegirAbierto(abierto);
            if (!abierto) setBusqueda("");
          }}
        >
          <SheetContent
            side="bottom"
            className="mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl border-ink/5 p-gap-md"
          >
            <SheetHeader>
              <SheetTitle className="text-left">Elige un producto</SheetTitle>
              <SheetDescription className="text-left">
                Centra la publicación en uno de tu carta. Escribe para
                encontrarlo.
              </SheetDescription>
            </SheetHeader>

            <div className="relative mt-gap-sm shrink-0">
              <Search
                size={16}
                strokeWidth={1.8}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft/50"
              />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar en tu carta…"
                className={cn(INPUT, "pl-10")}
              />
            </div>

            <div className="mt-gap-md flex shrink-0 items-center justify-between px-1">
              <span className="font-lv-display text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft/60">
                {termino ? "Resultados" : "Tu carta"}
              </span>
              <span className="text-meta text-ink-soft/50">
                {coincidencias.length}{" "}
                {coincidencias.length === 1 ? "producto" : "productos"}
              </span>
            </div>

            <div className="mt-2 flex flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pb-gap-sm">
              {!termino && (
                <button
                  type="button"
                  onClick={() => elegirProducto("")}
                  aria-pressed={!productoId}
                  className={cn(
                    "flex w-full touch-manipulation cursor-pointer items-center gap-gap-sm rounded-2xl border p-2.5 text-left transition duration-300 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
                    productoId
                      ? "border-ink/5 bg-white hover:border-verde-200 hover:bg-verde-50/40"
                      : "border-verde-300 bg-verde-50/60",
                  )}
                >
                  <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-ink/5 bg-sand-deep text-ink-soft/50">
                    <X size={20} strokeWidth={1.6} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-lv-display text-small font-semibold text-ink">
                      Sin producto concreto
                    </span>
                    <span className="mt-0.5 block truncate text-meta text-ink-soft/70">
                      La IA elige entre tu carta
                    </span>
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
                  <p className="text-small font-semibold text-ink">
                    Nada por aquí
                  </p>
                  <p className="text-meta text-ink-soft/70">
                    Prueba con otra palabra de tu carta.
                  </p>
                </div>
              ) : (
                coincidencias.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => elegirProducto(item.id)}
                    aria-pressed={item.id === productoId}
                    className={cn(
                      "flex w-full touch-manipulation cursor-pointer items-center gap-gap-sm rounded-2xl border p-2.5 text-left transition duration-300 ease-outquint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
                      item.id === productoId
                        ? "border-verde-300 bg-verde-50/60"
                        : "border-ink/5 bg-white hover:border-verde-200 hover:bg-verde-50/40",
                    )}
                  >
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-ink/5 bg-sand-deep">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="grid size-full place-items-center text-ink-soft/40">
                          <Package size={20} strokeWidth={1.6} />
                        </span>
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-lv-display text-small font-semibold text-ink">
                          {item.name}
                        </span>
                        {item.tag?.trim() && (
                          <span className="shrink-0 rounded-full bg-verde-400/15 px-2 py-[1px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.08em] text-verde-700">
                            {item.tag}
                          </span>
                        )}
                      </span>
                      {item.description?.trim() && (
                        <span className="mt-0.5 block truncate text-meta text-ink-soft/70">
                          {item.description}
                        </span>
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

        {/* El botón va fuera del campo, debajo y a la derecha: primero se escribe
            qué se quiere contar y luego se genera, y el resultado cae en las
            variantes de abajo. */}
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className={cn(INPUT, "h-auto resize-y py-3")}
          placeholder="Escribe tu prompt: qué quieres contar, el plato, la oferta, el tono…"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void generar()}
            disabled={generando || llenas || !prompt.trim()}
            className="inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 transition-colors duration-500 ease-outquint hover:bg-verde-300 disabled:pointer-events-none disabled:opacity-60"
          >
            {generando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} strokeWidth={1.8} />
            )}
            Generate with IA
          </button>
        </div>

        {datosEscasos && (
          <p className="rounded-xl border border-ink/10 bg-sand px-gap-md py-gap-sm text-meta text-ink-soft/70">
            Completa tu ficha y te saldrán mejores publicaciones.
          </p>
        )}

        {variantes.length > 0 && (
          <div className="grid gap-gap-sm md:grid-cols-2">
            {variantes.map((variante, i) => (
              <div
                key={i}
                className="flex flex-col gap-gap-sm rounded-xl border border-verde-200 bg-verde-50/50 p-gap-sm"
              >
                <span className="inline-flex w-fit items-center rounded-full border border-verde-200 bg-white px-[10px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-verde-700">
                  {ANGULO_LABEL[variante.angulo]}
                </span>
                <p className="whitespace-pre-wrap text-small text-ink">
                  {variante.texto}
                </p>
                <button
                  type="button"
                  onClick={() => setTexto(variante.texto)}
                  className={cn(BOTON_SECUNDARIO, "mt-auto self-start")}
                >
                  <Check size={14} strokeWidth={2} />
                  Usar esta
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="flex flex-col gap-gap-xs">
          <span className="font-lv-display text-meta font-semibold text-ink-soft/75">
            Texto del post
          </span>
          <textarea
            rows={5}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={cn(INPUT, "h-auto resize-y py-3")}
            placeholder="Elige una variante de arriba o escríbelo a mano."
          />
        </label>

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
              <p className="whitespace-pre-wrap text-small text-ink">
                {p.texto}
              </p>
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

/** El nombre de la sección no se repite: ya está en el navbar. */
function Encabezado() {
  return <h1 className="sr-only">Publicaciones</h1>;
}
