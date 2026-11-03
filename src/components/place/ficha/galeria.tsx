"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { PlacePhoto } from "@/lib/ficha/place-data";
import { COPY } from "@/config/ficha";
import { cn } from "@/lib/utils";

/**
 * La galería: fotos del local y portafolio de trabajos.
 *
 * La portada no se repite aquí —ya está arriba, a sangre—, así que esta sección
 * existe cuando el negocio subió fotos de verdad. Cada imagen abre un visor a
 * pantalla completa, porque en un móvil una rejilla de miniaturas se mira, no se
 * ve.
 */
export function Galeria({
  local,
  trabajos,
  className,
}: {
  local: PlacePhoto[];
  trabajos: PlacePhoto[];
  className?: string;
}) {
  const todas = [...local, ...trabajos];
  const [indice, setIndice] = useState<number | null>(null);

  if (todas.length === 0) return null;

  const activa = indice === null ? null : todas[indice];

  function mover(delta: number) {
    setIndice((actual) =>
      actual === null ? null : (actual + delta + todas.length) % todas.length,
    );
  }

  return (
    <section className={cn("min-w-0", className)}>
      <h2 className="mb-gap-sm font-lv-display text-h3 font-bold text-ink">
        {COPY.galeria}
      </h2>

      {local.length > 0 && (
        <Grupo
          titulo={COPY.elLocal}
          fotos={local}
          inicio={0}
          onAbrir={setIndice}
        />
      )}

      {trabajos.length > 0 && (
        <Grupo
          titulo={COPY.trabajos}
          fotos={trabajos}
          inicio={local.length}
          onAbrir={setIndice}
          className={local.length > 0 ? "mt-gap-md" : undefined}
        />
      )}

      <Dialog
        open={activa !== null}
        onOpenChange={(open) => {
          if (!open) setIndice(null);
        }}
      >
        <DialogContent className="w-[calc(100vw_-_32px)] max-w-6xl border-0 bg-ink p-0 shadow-none sm:w-[calc(100vw_-_64px)] [&>button]:text-white [&>button:hover]:bg-white/15 [&>button:hover]:text-white">
          <DialogTitle className="sr-only">Fotos de {COPY.galeria}</DialogTitle>
          {activa && (
            <div className="relative h-[82dvh] min-h-[240px] max-h-[900px] w-full">
              <Image
                src={activa.url!}
                alt={activa.alt || "Foto de la galería"}
                fill
                sizes="95vw"
                quality={92}
                className="object-contain"
              />
              {todas.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => mover(-1)}
                    aria-label="Foto anterior"
                    className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-ink/70 text-white hover:bg-ink/90"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(1)}
                    aria-label="Foto siguiente"
                    className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-ink/70 text-white hover:bg-ink/90"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/75 px-3 py-1 font-lv-display text-meta font-semibold text-white">
                {(indice ?? 0) + 1} / {todas.length}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Grupo({
  titulo,
  fotos,
  inicio,
  onAbrir,
  className,
}: {
  titulo: string;
  fotos: PlacePhoto[];
  inicio: number;
  onAbrir: (indice: number) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-gap-xs font-lv-display text-meta font-semibold uppercase tracking-[0.08em] text-ink-soft/60">
        {titulo}
      </p>
      <div className="grid grid-cols-2 gap-gap-xs sm:grid-cols-3">
        {fotos.map((foto, i) => {
          const esPrimera = i === 0 && fotos.length > 2;
          return (
            <figure
              key={`${foto.url}-${i}`}
              className={cn(
                "group relative overflow-hidden rounded-2xl bg-sand-deep",
                esPrimera ? "col-span-2 aspect-[16/10]" : "aspect-square",
              )}
            >
              <Image
                src={foto.url!}
                alt={foto.alt || `${titulo}, imagen ${i + 1}`}
                fill
                sizes={
                  esPrimera
                    ? "(min-width: 1024px) 640px, 90vw"
                    : "(min-width: 1024px) 320px, 45vw"
                }
                className="object-cover transition-transform duration-700 ease-outquint group-hover:scale-[1.03]"
              />
              <button
                type="button"
                onClick={() => onAbrir(inicio + i)}
                aria-label={`Ampliar ${titulo}, imagen ${i + 1}`}
                className="absolute inset-0 grid place-items-center bg-ink/0 text-white opacity-0 transition-all duration-500 ease-outquint hover:bg-ink/25 hover:opacity-100 focus-visible:bg-ink/25 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-verde-400"
              >
                <Expand size={22} strokeWidth={1.8} />
              </button>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
