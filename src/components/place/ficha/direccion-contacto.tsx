"use client";

import {
  Facebook,
  Globe,
  Instagram,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  type LucideIcon,
} from "lucide-react";
import type { PlaceData } from "@/lib/ficha/place-data";
import { COPY } from "@/config/ficha";
import { cn } from "@/lib/utils";
import { ReservaWhatsApp } from "../reserva-whatsapp";
import { SeguidorBoton } from "../seguidor-boton";

/**
 * Dirección, mapa y enlaces del negocio.
 *
 * Cada enlace se pinta solo si el dueño lo rellenó; sin dirección ni contactos
 * la tarjeta no aparece. La reserva y los avisos se quedan aquí cuando la barra
 * fija no los lleva, para que una ficha antigua —sin `acciones` configuradas—
 * siga teniendo el mismo botón que tenía antes.
 */
export function DireccionContacto({
  place,
  mostrarReserva,
  mostrarSeguidores,
  onNavigate,
  className,
}: {
  place: PlaceData;
  mostrarReserva?: boolean;
  mostrarSeguidores?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const { website, whatsapp, instagram, facebook } = place.contact;
  const hayDireccion = Boolean(place.address?.trim() || place.barrio?.trim());
  const hayAcciones = Boolean(
    (mostrarReserva && place.reserva) ||
    (mostrarSeguidores && place.seguidores),
  );

  const filas: {
    label: string;
    href: string;
    Icono: LucideIcon;
    externo?: boolean;
  }[] = [];

  if (whatsapp) {
    filas.push({
      label: COPY.whatsapp,
      href: whatsapp,
      Icono: MessageCircle,
      externo: true,
    });
  }
  if (place.phone) {
    filas.push({
      label: COPY.llamar,
      href: `tel:${place.phone.replace(/\s+/g, "")}`,
      Icono: Phone,
    });
  }
  if (website) {
    filas.push({
      label: COPY.sitioWeb,
      href: website,
      Icono: Globe,
      externo: true,
    });
  }
  if (instagram) {
    filas.push({
      label: "Instagram",
      href: instagram,
      Icono: Instagram,
      externo: true,
    });
  }
  if (facebook) {
    filas.push({
      label: "Facebook",
      href: facebook,
      Icono: Facebook,
      externo: true,
    });
  }

  if (!hayDireccion && filas.length === 0 && !hayAcciones) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-ink/5 bg-white p-gap-md shadow-soft",
        className,
      )}
    >
      {hayDireccion && (
        <div className="flex items-start gap-gap-sm">
          <span className="mt-[2px] grid size-8 shrink-0 place-items-center rounded-full bg-verde-50 text-verde-600">
            <MapPin size={16} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-lv-display text-meta font-semibold uppercase tracking-[0.06em] text-ink-soft/60">
              {COPY.direccion}
            </p>
            <p className="text-small leading-relaxed text-ink">
              {place.address
                ? `${place.address}, ${place.barrio}`
                : place.barrio}
            </p>
            {onNavigate && (
              <button
                type="button"
                onClick={onNavigate}
                className="mt-gap-xs inline-flex items-center gap-[5px] font-lv-display text-meta font-semibold text-verde-700 transition-colors duration-500 ease-outquint hover:text-verde-600"
              >
                <Navigation size={13} strokeWidth={2} />
                {COPY.verEnMapa}
              </button>
            )}
          </div>
        </div>
      )}

      {filas.length > 0 && (
        <div className={cn(hayDireccion && "mt-gap-md")}>
          <p className="mb-gap-xs font-lv-display text-meta font-semibold uppercase tracking-[0.06em] text-ink-soft/60">
            {COPY.contacto}
          </p>
          <div className="flex flex-wrap items-center gap-[6px]">
            {filas.map((fila) => (
              <a
                key={fila.label}
                href={fila.href}
                target={fila.externo ? "_blank" : undefined}
                rel={fila.externo ? "noopener noreferrer" : undefined}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 font-lv-display text-[12px] font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600"
              >
                <fila.Icono
                  size={15}
                  strokeWidth={1.8}
                  className="shrink-0 text-verde-600"
                />
                <span className="truncate">{fila.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {hayAcciones && (
        <div className="mt-gap-md flex flex-col gap-gap-xs border-t border-ink/5 pt-gap-md">
          {mostrarReserva && place.reserva && (
            <ReservaWhatsApp
              reserva={place.reserva}
              negocioId={place.id}
              className="w-full"
            />
          )}
          {mostrarSeguidores && place.seguidores && (
            <SeguidorBoton
              seguidores={place.seguidores}
              negocioId={place.id}
              variant="outline"
              className="w-full"
            />
          )}
        </div>
      )}
    </div>
  );
}
