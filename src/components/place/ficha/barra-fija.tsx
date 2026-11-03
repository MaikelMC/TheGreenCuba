"use client";

import Link from "next/link";
import { MessageCircle, Navigation, Phone, ShoppingCart } from "lucide-react";
import type { PlaceData } from "@/lib/ficha/place-data";
import type { AccionBarra } from "@/lib/ficha/acciones";
import { COPY } from "@/config/ficha";
import { cn } from "@/lib/utils";
import { ReservaWhatsApp } from "../reserva-whatsapp";

const BTN =
  "inline-flex h-12 flex-1 items-center justify-center gap-gap-xs rounded-2xl font-lv-display text-small font-semibold transition-colors duration-500 ease-outquint active:scale-[0.98]";
const BTN_PRIMARIA =
  "bg-verde-400 text-verde-950 shadow-primary-halo hover:bg-verde-300";
const BTN_SECUNDARIA =
  "border border-ink/10 bg-white text-ink hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600";

/**
 * La barra fija del móvil: la acción principal del negocio y, como mucho, una
 * secundaria.
 *
 * Cuando `carritoHref` y `carritoLabel` llegan, la acción «pedir» muestra el
 * estado del carrito en vez del enlace a la carta. Sin ellos, el botón sigue
 * yendo a `/m/[slug]` como antes.
 */
export function BarraFija({
  acciones,
  place,
  carritoHref,
  carritoLabel,
  onNavigate,
  className,
}: {
  acciones: AccionBarra[];
  place: PlaceData;
  /** URL de WhatsApp con el pedido. Solo cuando el carrito tiene ítems. */
  carritoHref?: string;
  /** Etiqueta del carrito: «Pedir 3 · 120 CUP». */
  carritoLabel?: string;
  onNavigate?: () => void;
  className?: string;
}) {
  if (acciones.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-sand-warm/95 px-gutter pt-gap-sm backdrop-blur-[16px] pb-[calc(12px+env(safe-area-inset-bottom))] lg:hidden",
        className,
      )}
    >
      <div className="mx-auto flex max-w-container items-center gap-gap-xs">
        {acciones.map((accion, index) => {
          const primaria = index === 0;
          const clase = cn(BTN, primaria ? BTN_PRIMARIA : BTN_SECUNDARIA);

          if (accion === "pedir") {
            /* Con carrito activo: enlaza directamente a WhatsApp. Sin él,
               va a la carta como antes. */
            if (carritoHref && carritoLabel) {
              return (
                <a
                  key={accion}
                  href={carritoHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(clase, "gap-gap-sm")}
                >
                  <ShoppingCart size={17} strokeWidth={1.8} className="shrink-0" />
                  {carritoLabel}
                </a>
              );
            }
            return (
              <Link key={accion} href={`/m/${place.slug}`} className={clase}>
                {COPY.pedir}
              </Link>
            );
          }

          if (
            (accion === "reservar" ||
              accion === "apartar" ||
              accion === "cita") &&
            place.reserva
          ) {
            return (
              <ReservaWhatsApp
                key={accion}
                reserva={place.reserva}
                negocioId={place.id}
                variant={primaria ? "primary" : "outline"}
                className="flex-1"
              />
            );
          }

          if (accion === "como_llegar") {
            return (
              <button
                key={accion}
                type="button"
                onClick={onNavigate}
                className={clase}
              >
                <Navigation size={17} strokeWidth={1.8} className="shrink-0" />
                {COPY.comoLlegar}
              </button>
            );
          }

          if (accion === "llamar" && place.phone) {
            return (
              <a
                key={accion}
                href={`tel:${place.phone.replace(/\s+/g, "")}`}
                className={clase}
              >
                <Phone size={17} strokeWidth={1.8} className="shrink-0" />
                {COPY.llamar}
              </a>
            );
          }

          if (accion === "whatsapp" && place.contact.whatsapp) {
            return (
              <a
                key={accion}
                href={place.contact.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={clase}
              >
                <MessageCircle
                  size={17}
                  strokeWidth={1.8}
                  className="shrink-0"
                />
                {COPY.whatsapp}
              </a>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
