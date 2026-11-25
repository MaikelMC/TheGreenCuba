"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { BotonIconoAdmin } from "./botones";

/* El mismo corte que `lg` de Tailwind. */
const ESCRITORIO = "(min-width: 1024px)";

function suscribir(avisar: () => void) {
  const mq = window.matchMedia(ESCRITORIO);
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
}

/** En el servidor no hay ventana: se pinta la versión de móvil. */
function useEsEscritorio(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(ESCRITORIO).matches,
    () => false,
  );
}

/**
 * La hoja del panel: sube desde abajo en móvil y es un panel lateral de 480 px
 * en escritorio. Es la misma pieza para la ficha 360 y para las confirmaciones.
 *
 * Las dos variantes son un `Sheet` de Radix, así que traen trampa de foco,
 * `Escape`, cierre al tocar fuera y vuelta del foco al botón que la abrió.
 * `panel-portal` es obligatoria: el contenido se pinta fuera de `.admin-panel` y
 * sin esa clase no le llegan los overrides oscuros.
 */
export function HojaAdmin({
  open,
  onOpenChange,
  titulo,
  descripcion,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: ReactNode;
  descripcion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const escritorio = useEsEscritorio();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={escritorio ? "right" : "bottom"}
        hideClose
        className={clsx(
          "panel-portal scrollbar-fino flex flex-col gap-gap-md overflow-y-auto overscroll-contain",
          escritorio ? "w-full max-w-[480px]" : "max-h-[92dvh] rounded-t-2xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-gap-sm">
          <div className="min-w-0 pt-[10px]">
            <SheetTitle className="font-lv-display text-h3 font-bold text-ink">
              {titulo}
            </SheetTitle>
            {descripcion && (
              <SheetDescription className="mt-gap-xs text-small text-ink-soft/75">
                {descripcion}
              </SheetDescription>
            )}
          </div>
          <SheetClose asChild>
            <BotonIconoAdmin aria-label="Cerrar">
              <X size={20} strokeWidth={1.8} />
            </BotonIconoAdmin>
          </SheetClose>
        </div>
        <div className="flex flex-col gap-gap-md pb-safe-bottom">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
