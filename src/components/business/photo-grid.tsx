"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Image as ImageIcon, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { prepareImage } from "@/lib/storage/compress";
import { usePlaces } from "@/providers/places-provider";

export interface PlaceImage {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  isCover: boolean;
}

interface PhotoGridProps {
  /**
   * `null` mientras el negocio no existe. `place_images.place_id` es clave
   * foránea, así que no hay dónde colgar la foto hasta que se guarde la ficha.
   */
  placeId: string | null;
  /** Para el texto alternativo, que es lo que lee un lector de pantalla. */
  placeName: string;
  className?: string;
}

/* Ocho fotos por negocio. No es una regla de negocio, es un tope de cordura: la
   rejilla crece sola y sin freno el formulario se come la pantalla. */
const MAX_SLOTS = 8;

/**
 * Rejilla de fotos del negocio.
 *
 * Antes era decorativa: pintaba degradados y sus botones no hacían nada. Ahora
 * sube de verdad, y la compresión pasa antes de salir del navegador, en
 * `prepareImage()`. Una foto de móvil de 4 MB llega al bucket con unos 250 KB.
 */
export function PhotoGrid({ placeId, placeName, className }: PhotoGridProps) {
  const [images, setImages] = useState<PlaceImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /* La ficha pública se pinta con la copia del catálogo que tiene el provider,
     y las fotos no van por ahí. Sin esto, subir una foto y abrir la ficha en la
     misma sesión la enseñaría sin ella. */
  const { refreshPlaces } = usePlaces();

  /* Cuántas fotos hay, para el recuento de más abajo. Va en un ref y no se lee
     de `images`: `upload` está memorizado sin `images` en las dependencias, así
     que la copia que cierra se queda vieja en cuanto sube la primera foto. */
  const countRef = useRef(0);
  useEffect(() => {
    countRef.current = images.length;
  }, [images.length]);

  /* Devuelve la lista, y no solo la pinta: quien sube la necesita para saber si
     una petición que no contestó llegó a escribir de todas formas. */
  const load = useCallback(async (): Promise<PlaceImage[]> => {
    if (!placeId) {
      setImages([]);
      return [];
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/places/${placeId}/images`);
      const rows = res.ok ? ((await res.json()) as PlaceImage[]) : [];
      setImages(rows);
      return rows;
    } catch {
      setError("No se pudieron cargar las fotos.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [placeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = useCallback(
    async (files: File[]) => {
      if (!placeId || files.length === 0) return;
      setBusy(true);
      setError(null);

      const before = countRef.current;
      let failed = 0;

      try {
        for (const file of files) {
          /* `try` por archivo y no alrededor del bucle entero: con el de fuera,
             una sola foto que fallara —demasiado grande, o un formato que el
             navegador no sabe leer— dejaba a las demás sin subir, y había que
             volver a elegirlas de una en una. */
          try {
            const prepared = await prepareImage(file);

            const form = new FormData();
            form.append("file", prepared.blob, prepared.name);
            form.append("alt", `Foto de ${placeName}`);
            /* Las dimensiones solo sirven para reservar el hueco antes de que la
               imagen cargue. Si no se pudieron leer, se omiten. */
            if (prepared.width) form.append("width", String(prepared.width));
            if (prepared.height) form.append("height", String(prepared.height));

            const res = await fetch(`/api/places/${placeId}/images`, {
              method: "POST",
              body: form,
            });
            if (!res.ok) {
              const data = (await res.json().catch(() => null)) as { error?: string } | null;
              throw new Error(data?.error ?? "No se pudo subir la foto.");
            }
            const created = (await res.json()) as PlaceImage;
            setImages((prev) => [...prev, created]);
            void refreshPlaces();
          } catch {
            failed += 1;
          }
        }
      } finally {
        setBusy(false);
      }

      if (failed === 0) return;

      /* Una petición cortada por el camino deja la fila escrita igual: el
         servidor inserta antes de contestar, y aquí la red se corta. Así que
         antes de decir que falló se relee la lista del servidor y se cuentan.
         Si llegaron todas, lo que se perdió fue la respuesta y avisar sería
         mentir; si no, falta alguna de verdad y sí hay que decirlo. */
      const current = await load();
      if (current.length - before >= files.length) return;

      setError(
        failed === 1
          ? "No se pudo subir una de las fotos. Vuelve a elegirla."
          : `No se pudieron subir ${failed} de las fotos. Vuelve a elegirlas.`,
      );
    },
    [placeId, placeName, refreshPlaces, load],
  );

  const remove = useCallback(
    async (imageId: string) => {
      if (!placeId) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/places/${placeId}/images?imageId=${imageId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "No se pudo borrar la foto.");
        }
        /* Se relee en vez de filtrar la lista en memoria: al borrar la portada
           el servidor asciende la siguiente, y adivinar cuál es aquí sería
           duplicar esa regla. */
        await load();
        void refreshPlaces();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo borrar la foto.");
      } finally {
        setBusy(false);
      }
    },
    [placeId, load, refreshPlaces],
  );

  if (!placeId) {
    return (
      <p className="text-meta text-ink-soft/75">
        Guarda el negocio primero. En cuanto tenga ficha se le pueden añadir
        fotos, hasta {MAX_SLOTS}.
      </p>
    );
  }

  /* La portada va primera porque es la que se enseña en la tarjeta y en la
     ficha; el resto, en el orden en que se subieron. */
  const filled = [...images].sort((a, b) => Number(b.isCover) - Number(a.isCover));
  /* **Una** casilla de añadir, no dos. Aquí había `Math.min(2, …)`, y en el
     formulario se leían como un control duplicado —dos cuadros iguales, lado a
     lado, con el mismo rótulo— en vez de como «caben dos fotos más». El otro
     sitio donde se suben fotos, el alta del perfil, siempre tuvo una. */
  const canAdd = filled.length < MAX_SLOTS;

  return (
    <div className={className}>
      <p className="text-meta text-ink-soft/75 mb-gap-md">
        Sube fotos de tu negocio. Se reducen a 1600 px y se convierten a WebP
        antes de salir de tu dispositivo. La primera será la foto de portada.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          /* Se vacía el input para que elegir otra vez el mismo archivo vuelva a
             disparar el `change`; si no, el segundo intento no hace nada. */
          e.target.value = "";
          void upload(files);
        }}
      />

      <div className="grid grid-cols-3 lg:grid-cols-4 gap-gap-xs">
        {filled.map((image) => (
          <div
            key={image.id}
            className={cn(
              "relative rounded-2xl border border-ink/5 overflow-hidden group bg-sand-deep",
              image.isCover ? "col-span-full aspect-[16/9]" : "aspect-square",
            )}
          >
            <Image
              src={image.url}
              alt={image.alt ?? `Foto de ${placeName}`}
              fill
              sizes={image.isCover ? "(min-width: 1024px) 640px, 100vw" : "(min-width: 1024px) 200px, 33vw"}
              className="object-cover"
            />
            <button
              type="button"
              onClick={() => void remove(image.id)}
              disabled={busy}
              className="absolute top-[6px] right-[6px] size-7 rounded-full bg-ink/70 text-white grid place-items-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-500 ease-outquint z-10 cursor-pointer disabled:opacity-40"
              aria-label={`Eliminar ${image.alt ?? "foto"}`}
            >
              <X size={14} strokeWidth={1.8} />
            </button>
            {image.isCover && (
              <span className="absolute bottom-[8px] left-[8px] bg-ink/70 text-white px-[10px] py-[3px] rounded-full font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em]">
                Portada
              </span>
            )}
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="aspect-square rounded-2xl border border-dashed border-ink/10 flex flex-col items-center justify-center gap-[6px] cursor-pointer text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 transition-all duration-500 ease-outquint disabled:opacity-40 disabled:cursor-default disabled:hover:border-ink/10 disabled:hover:bg-transparent"
          >
            {busy ? (
              <Loader2 size={24} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <Plus size={24} strokeWidth={1.8} />
            )}
            <span className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em]">
              {busy ? "Subiendo" : "Añadir"}
            </span>
          </button>
        )}
      </div>

      {loading && (
        <p className="flex items-center gap-gap-xs text-meta text-ink-soft/75 mt-gap-sm">
          <ImageIcon size={14} strokeWidth={1.8} />
          Cargando fotos…
        </p>
      )}

      {error && (
        <p role="alert" className="mt-gap-sm px-3 py-[7px] rounded-xl bg-destructive/10 border border-destructive/25 text-meta text-destructive font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
