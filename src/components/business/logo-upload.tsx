"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { prepareImage } from "@/lib/storage/compress";

interface LogoUploadProps {
  /**
   * `null` mientras el negocio no existe: la subida va a
   * `/api/places/[id]/logo` y esa ruta exige que la ficha esté guardada. Mismo
   * caso que `PhotoGrid`, y el mismo aviso.
   */
  placeId: string | null;
  /** URL del logo ya guardado, o vacío. */
  value: string;
  onChange: (url: string) => void;
  className?: string;
}

/**
 * El logotipo del negocio: una sola imagen, en redondo.
 *
 * Una sola y no una rejilla: en la ficha el logo va en un círculo, así que subir
 * dos no significaría nada. El archivo se comprime en el navegador con
 * `prepareImage()`, igual que las fotos del lugar y las del menú.
 *
 * La URL no se guarda aquí: sube al bucket, vuelve, y se queda en el estado del
 * formulario. Quien la persiste es el PATCH del formulario al guardar, como las
 * fotos del menú. Si nadie guarda, queda un archivo de más en el bucket —
 * aceptado y documentado en la ruta.
 */
export function LogoUpload({
  placeId,
  value,
  onChange,
  className,
}: LogoUploadProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!placeId) {
    return (
      <p className={cn("text-meta text-ink-soft/75", className)}>
        Guarda el negocio primero. En cuanto tenga ficha se le puede poner logo.
      </p>
    );
  }

  async function upload(file: File | undefined) {
    if (!file || !placeId) return;
    setBusy(true);
    setError(null);
    try {
      const prepared = await prepareImage(file);
      const form = new FormData();
      form.append("file", prepared.blob, prepared.name);

      const res = await fetch(`/api/places/${placeId}/logo`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "No se pudo subir el logo.");
      }
      onChange(((await res.json()) as { url: string }).url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el logo.");
    } finally {
      setBusy(false);
    }
  }

  /* Best-effort y sin `await` que importe: si el borrado del objeto falla, la
     URL se va igual del formulario y el botón queda libre. */
  async function clear() {
    const url = value;
    onChange("");
    setError(null);
    if (!url) return;
    try {
      await fetch(
        `/api/places/${placeId}/logo?url=${encodeURIComponent(url)}`,
        { method: "DELETE" },
      );
    } catch {
      /* El objeto se queda huérfano en el bucket, que es el mismo coste que
         dejar el archivo sin guardar la ficha. La fila ya no lo apunta. */
    }
  }

  return (
    <div className={cn("flex items-center gap-gap-md", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          /* Se vacía el input para que elegir otra vez el mismo archivo vuelva a
             disparar el `change`; si no, el segundo intento no hace nada. */
          e.target.value = "";
          void upload(file);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={value ? "Cambiar el logo" : "Subir un logo"}
        className="relative size-20 shrink-0 overflow-hidden rounded-full border border-dashed border-ink/15 bg-sand-warm grid place-items-center cursor-pointer text-ink-soft/75 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 transition-all duration-500 ease-outquint disabled:opacity-50 disabled:cursor-default"
      >
        {value ? (
          <Image src={value} alt="" fill sizes="80px" className="object-cover" />
        ) : busy ? (
          <Loader2 size={22} strokeWidth={1.8} className="animate-spin" />
        ) : (
          <Plus size={22} strokeWidth={1.8} />
        )}
      </button>

      <div className="min-w-0">
        <p className="font-lv-display text-small font-semibold text-ink">
          Logo del negocio
        </p>
        <p className="text-meta text-ink-soft/75 leading-relaxed">
          Se ve en redondo en la ficha, en las tarjetas y en el pin del mapa. Lo
          mejor es un cuadrado; se recorta solo.
        </p>
        <div className="mt-gap-xs flex items-center gap-gap-sm">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="font-lv-display text-meta font-semibold text-verde-600 hover:text-verde-700 cursor-pointer disabled:opacity-50 disabled:cursor-default"
          >
            {busy ? "Subiendo…" : value ? "Cambiar" : "Subir imagen"}
          </button>
          {value && !busy && (
            <button
              type="button"
              onClick={() => void clear()}
              className="inline-flex items-center gap-1 font-lv-display text-meta font-semibold text-ink-soft/75 hover:text-destructive cursor-pointer"
            >
              <X size={13} strokeWidth={1.8} />
              Quitar
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-gap-xs text-meta font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
