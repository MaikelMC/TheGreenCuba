"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ImageCropDialogProps {
  file: File;
  title: string;
  /** Recibe el recorte como archivo nuevo, listo para el mismo flujo de subida. */
  onConfirm: (cropped: File) => void;
  onCancel: () => void;
}

type Offset = { x: number; y: number };

/* Lado del recorte en píxeles. No pasa de 1024: el logo se ve en 80 px y la
   foto del producto en 112, así que más resolución solo engorda el bucket. */
const MAX_OUTPUT = 1024;
const MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Recorte cuadrado con arrastre y zoom, sin dependencias.
 *
 * El `file` original nunca se toca: se enseña desde un `objectURL`, el encuadre
 * vive en estado y el recorte se pinta en un `<canvas>` al confirmar. Así la
 * misma imagen se puede reencuadrar las veces que haga falta sin volver a
 * elegirla.
 */
export function ImageCropDialog({
  file,
  title,
  onConfirm,
  onCancel,
}: ImageCropDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  /* Lado del lienzo en píxeles reales: el recorte se calcula contra él, no
     contra el tamaño CSS teórico. */
  const [stage, setStage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<Offset>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    setNatural(null);
    setZoom(1);
    setPos({ x: 0, y: 0 });
    setError(null);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Centrar al cargar la imagen y cuando el lienzo cambia de tamaño. `natural`
     y `stage` son las dos únicas entradas que mueven el encuadre inicial; el
     zoom y el arrastre posteriores son gestos del usuario. */
  useEffect(() => {
    if (!natural || !stage) return;
    const scale = Math.max(stage / natural.w, stage / natural.h);
    setZoom(1);
    setPos({
      x: (stage - natural.w * scale) / 2,
      y: (stage - natural.h * scale) / 2,
    });
  }, [natural, stage]);

  const clamped = useCallback(
    (p: Offset, zoomValue: number): Offset => {
      if (!natural || !stage) return p;
      const scale = Math.max(stage / natural.w, stage / natural.h) * zoomValue;
      const w = natural.w * scale;
      const h = natural.h * scale;
      return {
        x: clamp(p.x, stage - w, 0),
        y: clamp(p.y, stage - h, 0),
      };
    },
    [natural, stage],
  );

  function changeZoom(next: number) {
    /* El centro del lienzo se queda quieto: encoger o agrandar alrededor del
       borde superior izquierdo movía el encuadre que el usuario ya había
       elegido. */
    const ratio = next / zoom;
    setPos((p) =>
      clamped(
        {
          x: stage / 2 - (stage / 2 - p.x) * ratio,
          y: stage / 2 - (stage / 2 - p.y) * ratio,
        },
        next,
      ),
    );
    setZoom(next);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* Sin captura el arrastre sigue mientras el dedo no salga del lienzo. */
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    setPos(
      clamped(
        {
          x: start.x + e.clientX - start.px,
          y: start.y + e.clientY - start.py,
        },
        zoom,
      ),
    );
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* el puntero ya no estaba activo */
    }
  }

  async function confirm() {
    if (!natural || !stage || !url) return;
    setBusy(true);
    setError(null);
    try {
      /* Se decodifica aparte para el lienzo: el `<img>` de la vista previa ya
         cargó, así que esto solo falla si el formato no es dibujable. */
      const image = new Image();
      image.src = url;
      await image.decode();

      const scale = Math.max(stage / natural.w, stage / natural.h) * zoom;
      const sx = -pos.x / scale;
      const sy = -pos.y / scale;
      const side = stage / scale;
      const output = Math.max(1, Math.min(MAX_OUTPUT, Math.round(side)));

      const canvas = document.createElement("canvas");
      canvas.width = output;
      canvas.height = output;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("El navegador no dio contexto 2D");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, sx, sy, side, side, 0, 0, output, output);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.85),
      );
      if (!blob) throw new Error("No se pudo codificar el recorte");
      /* Donde no hay WebP —Safari— `toBlob` devuelve PNG; el nombre y el tipo
         salen del blob real, no del que se pidió. */
      const extension = blob.type === "image/webp" ? "webp" : "png";
      const base = file.name.replace(/\.[^.]+$/, "") || "imagen";
      onConfirm(
        new File([blob], `${base}-recorte.${extension}`, { type: blob.type }),
      );
    } catch {
      setError(
        "No se pudo recortar esta imagen. Puedes subirla tal cual sin recortar.",
      );
    } finally {
      setBusy(false);
    }
  }

  const scale = natural
    ? Math.max(stage / natural.w, stage / natural.h) * zoom
    : 1;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Arrastra la imagen para elegir el encuadre y ajusta el zoom.
        </DialogDescription>

        <div
          ref={stageRef}
          role="application"
          tabIndex={0}
          aria-label="Encuadre de la imagen. Arrastra o usa las flechas para moverla."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 32 : 12;
            const moves: Record<string, Offset> = {
              ArrowLeft: { x: step, y: 0 },
              ArrowRight: { x: -step, y: 0 },
              ArrowUp: { x: 0, y: step },
              ArrowDown: { x: 0, y: -step },
            };
            const move = moves[e.key];
            if (!move) return;
            e.preventDefault();
            setPos((p) => clamped({ x: p.x + move.x, y: p.y + move.y }, zoom));
          }}
          className="relative mx-auto aspect-square w-full max-w-[320px] cursor-grab touch-none overflow-hidden rounded-2xl bg-ink/90 active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/50"
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              draggable={false}
              onLoad={(e) =>
                setNatural({
                  w: e.currentTarget.naturalWidth,
                  h: e.currentTarget.naturalHeight,
                })
              }
              onError={() =>
                setError(
                  "No se pudo abrir esta imagen. Puedes subirla tal cual sin recortar.",
                )
              }
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                left: pos.x,
                top: pos.y,
                width: natural ? natural.w * scale : "100%",
                height: natural ? natural.h * scale : "100%",
              }}
            />
          )}
          {!natural && !error && (
            <div className="absolute inset-0 grid place-items-center text-white/70">
              <Loader2 size={24} strokeWidth={1.8} className="animate-spin" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-gap-sm">
          <span className="font-lv-display text-meta font-semibold text-ink-soft/75">
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
            className="w-full accent-verde-600"
            aria-label="Zoom del recorte"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-[7px] text-meta font-medium text-destructive"
          >
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          {error ? (
            <Button type="button" onClick={() => onConfirm(file)}>
              Subir sin recortar
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void confirm()}
              disabled={busy || !natural}
            >
              {busy ? (
                <Loader2 size={16} strokeWidth={2} className="animate-spin" />
              ) : (
                "Usar esta imagen"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
