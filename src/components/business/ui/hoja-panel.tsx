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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { BotonIcono } from "./botones";

/* El mismo corte que `lg` de Tailwind y que el cajón de `panel-shell.tsx`. */
const ESCRITORIO = "(min-width: 1024px)";

function suscribir(avisar: () => void) {
  const mq = window.matchMedia(ESCRITORIO);
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
}

/** En el servidor no hay ventana: se pinta la versión de móvil, la mayoritaria. */
function useEsEscritorio(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(ESCRITORIO).matches,
    () => false,
  );
}

/**
 * La hoja del panel: sube desde abajo en el móvil y es un diálogo centrado en
 * escritorio. Las dos son Radix Dialog por debajo, así que traen trampa de foco,
 * `Escape`, cierre al tocar fuera y vuelta del foco al botón que la abrió.
 *
 * Lleva `panel-portal`: el contenido se pinta en un portal, fuera de
 * `.business-panel`, y sin esa clase los overrides oscuros del panel no le
 * llegan (`globals.css`). Toda hoja, diálogo o select que se abra desde el
 * panel tiene que llevarla.
 *
 * El aspa es la del panel, de 44 px; la de serie del `Sheet` medía 36. No hay
 * gesto de deslizar para cerrar: Radix no lo trae.
 */
export function HojaPanel({
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

  if (escritorio) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          hideClose
          {...(descripcion ? {} : { "aria-describedby": undefined })}
          className={clsx("panel-portal scrollbar-fino flex flex-col", className)}
        >
          <div className="flex items-start justify-between gap-gap-sm">
            <div className="min-w-0 pt-[10px]">
              <DialogTitle>{titulo}</DialogTitle>
              {descripcion && (
                <DialogDescription className="mt-gap-xs">{descripcion}</DialogDescription>
              )}
            </div>
            <DialogClose asChild>
              <BotonIcono aria-label="Cerrar">
                <X size={20} strokeWidth={1.8} />
              </BotonIcono>
            </DialogClose>
          </div>
          <div className="flex flex-col gap-gap-md">{children}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        {...(descripcion ? {} : { "aria-describedby": undefined })}
        className={clsx(
          "panel-portal scrollbar-fino flex max-h-[85dvh] flex-col overflow-y-auto overscroll-contain rounded-t-2xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-gap-sm">
          <div className="min-w-0 pt-[10px]">
            <SheetTitle>{titulo}</SheetTitle>
            {descripcion && (
              <SheetDescription className="mt-gap-xs">{descripcion}</SheetDescription>
            )}
          </div>
          <SheetClose asChild>
            <BotonIcono aria-label="Cerrar">
              <X size={20} strokeWidth={1.8} />
            </BotonIcono>
          </SheetClose>
        </div>
        {/* El indicador de inicio de iOS tapaba el último botón de la hoja. */}
        <div className="flex flex-col gap-gap-md pb-safe-bottom">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
