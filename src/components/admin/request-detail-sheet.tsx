"use client";

import { useRef } from "react";
import Image from "next/image";
import {
  CalendarClock,
  Clock3,
  Globe,
  MapPin,
  Phone,
  Tag,
  UtensilsCrossed,
} from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/admin/category-icon";
import { placeIcon } from "@/lib/places";
import { usePlaces } from "@/providers/places-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type { UserPlace } from "@/lib/places-store";

/**
 * Etiqueta de sección, igual que las del panel: mayúsculas espaciadas de
 * 10 px. Un componente local porque el detalle repite la estructura ocho
 * veces y cada copia a mano era una oportunidad más de desalinearse.
 */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-gap-xs">
      <span className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
        {label}
      </span>
      {children}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  children,
  href,
}: {
  icon: typeof MapPin;
  children: React.ReactNode;
  /** Si viene, la fila entera es un enlace —tel:, web, mapa—. */
  href?: string;
}) {
  const content = (
    <>
      <Icon size={15} strokeWidth={1.8} className="text-verde-600 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel="noopener noreferrer"
        className="flex items-start gap-gap-xs text-small text-ink transition-colors duration-500 ease-outquint hover:text-verde-600"
      >
        {content}
      </a>
    );
  }
  return (
    <div className="flex items-start gap-gap-xs text-small text-ink">{content}</div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-sand px-[10px] py-[3px] font-lv-display text-meta font-medium text-ink-soft/75">
      {children}
    </span>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface RequestDetailSheetProps {
  /** La solicitud a mostrar. `null` = sheet cerrado. */
  place: UserPlace | null;
  onClose: () => void;
  onApprove: (id: string, name: string) => void;
  onReject: (id: string, name: string) => void;
}

/**
 * Detalle completo de una solicitud de negocio.
 *
 * El admin solo ve nombre, categoría y dirección en la lista; todo lo que el
 * dueño rellenó —descripción, horario, contacto, pagos, ambiente, menú,
 * oferta y fotos— vive aquí. La decisión de aprobar o rechazar se puede tomar
 * desde la lista o desde el propio detalle, sin cerrar nada.
 */
export function RequestDetailSheet({
  place,
  onClose,
  onApprove,
  onReject,
}: RequestDetailSheetProps) {
  const { categories } = usePlaces();

  /* Conserva la última solicitud mientras el sheet sale en la animación de
     cierre: Radix desmonta el contenido cuando `open` pasa a false y sin este
     recuerdo el contenido desaparecería de golpe antes de terminar la
     transición. */
  const lastPlace = useRef<UserPlace | null>(null);
  if (place) lastPlace.current = place;
  const shown = place ?? lastPlace.current;

  const cover = shown?.photos?.find((p) => p.isCover) ?? shown?.photos?.[0];
  const gallery = shown?.photos?.filter((p) => p !== cover) ?? [];
  const website = shown?.website
    ? shown.website.startsWith("http")
      ? shown.website
      : `https://${shown.website}`
    : undefined;

  return (
    <Sheet open={place !== null} onOpenChange={(open) => !open && onClose()}>
      {shown && (
        <SheetContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-t-4xl p-0">
          {/* Portada: la foto del negocio si la subió; si no, el degradado con
              el icono de su categoría, igual que la ficha del home. */}
          {cover ? (
            <div className="relative h-[180px] shrink-0 bg-sand-deep">
              <Image
                src={cover.url}
                alt={cover.alt ?? `Foto de ${shown.name}`}
                fill
                sizes="(min-width: 640px) 560px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/45 to-transparent" />
              <div className="absolute bottom-gap-sm left-gap-md right-gap-md">
                <SheetTitle className="text-h3 font-bold text-white drop-shadow-sm">
                  {shown.name}
                </SheetTitle>
                <SheetDescription className="text-small text-white/85">
                  {shown.category}
                  {shown.barrio ? ` · ${shown.barrio}` : ""}
                </SheetDescription>
              </div>
            </div>
          ) : (
            <div className="relative grid h-[140px] shrink-0 place-items-center bg-gradient-to-br from-verde-50 to-verde-100">
              <CategoryIcon
                icon={placeIcon(shown.icon, shown.category, categories)}
                size={56}
                strokeWidth={1.4}
                className="text-verde-600"
              />
              <SheetTitle className="sr-only">{shown.name}</SheetTitle>
              <SheetDescription className="sr-only">
                Detalle de la solicitud de {shown.name}
              </SheetDescription>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-gap-md py-gap-md">
            {/* Cabecera cuando la portada es el degradado: ahí el nombre no
                quedó pintado encima. */}
            {!cover && (
              <div className="mb-gap-md">
                <h3 className="font-lv-display text-h3 font-bold tracking-[-0.02em] text-ink">
                  {shown.name}
                </h3>
                <p className="text-small text-ink-soft/75 mt-[2px]">
                  {shown.category}
                  {shown.barrio ? ` · ${shown.barrio}` : ""}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-[6px] mb-gap-md">
              <span className="inline-flex items-center gap-[4px] rounded-full bg-sand px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft/75">
                Pendiente
              </span>
              {shown.isBoosted && (
                <span className="inline-flex items-center gap-[4px] rounded-full bg-verde-100 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em] text-verde-700">
                  Destacado
                </span>
              )}
              <span className="inline-flex items-center gap-[4px] font-lv-display text-meta text-ink-soft/75">
                <CalendarClock size={13} strokeWidth={1.8} />
                Enviado el {formatDate(new Date(shown.createdAt).toISOString())}
              </span>
            </div>

            <div className="flex flex-col gap-gap-md">
              <Section label="Descripción">
                <p className="text-small leading-relaxed text-ink text-pretty">
                  {shown.description || "El negocio no añadió descripción."}
                </p>
              </Section>

              <Section label="Ubicación y contacto">
                <div className="flex flex-col gap-[6px]">
                  <InfoRow icon={MapPin} href={`https://www.google.com/maps/search/?api=1&query=${shown.lat},${shown.lng}`}>
                    {[
                      shown.address,
                      shown.barrio,
                      shown.city,
                      shown.province,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Dirección no indicada"}
                  </InfoRow>
                  {shown.phone && <InfoRow icon={Phone} href={`tel:${shown.phone}`}>{shown.phone}</InfoRow>}
                  {website && <InfoRow icon={Globe} href={website}>{shown.website}</InfoRow>}
                  {!shown.phone && !website && (
                    <p className="text-small text-ink-soft/75">
                      Sin teléfono ni web indicados.
                    </p>
                  )}
                </div>
              </Section>

              <Section label="Horario">
                <div className="flex items-start gap-gap-xs text-small text-ink">
                  <Clock3 size={15} strokeWidth={1.8} className="text-verde-600 shrink-0" />
                  <span>{shown.schedule || "Sin horario indicado."}</span>
                </div>
              </Section>

              {(shown.payments.length > 0 || (shown.vibe?.length ?? 0) > 0) && (
                <Section label="Pagos y ambiente">
                  <div className="flex flex-wrap gap-[6px]">
                    {shown.payments.map((p) => (
                      <Chip key={p}>{p === "MLC" ? "USD Clásica" : p}</Chip>
                    ))}
                    {shown.vibe?.map((v) => (
                      <Chip key={v}>{v}</Chip>
                    ))}
                  </div>
                </Section>
              )}

              {shown.menu.length > 0 && (
                <Section label="Menú">
                  <div className="flex flex-col gap-gap-xs">
                    {shown.menu.map((item, i) => (
                      <div
                        key={`${item.name}-${i}`}
                        className="flex items-start justify-between gap-gap-sm rounded-xl border border-ink/5 bg-sand/50 px-gap-sm py-gap-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-gap-xs flex-wrap">
                            <span className="font-lv-display text-small font-semibold text-ink">
                              {item.name}
                            </span>
                            {item.tag && (
                              <span className="inline-flex items-center gap-[4px] rounded-full bg-verde-100 px-[8px] py-[1px] font-lv-display text-[10px] font-semibold text-verde-700">
                                <Tag size={10} strokeWidth={2} />
                                {item.tag}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-meta text-ink-soft/75 mt-[2px]">{item.description}</p>
                          )}
                        </div>
                        <span className="shrink-0 font-lv-display text-small font-semibold text-ink">
                          {item.price}
                          {item.currency ? ` ${item.currency}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {shown.offer?.text && (
                <Section label="Oferta">
                  <div className="flex items-start gap-gap-xs rounded-xl border border-verde-200 bg-verde-50 px-gap-sm py-gap-xs">
                    <UtensilsCrossed size={15} strokeWidth={1.8} className="text-verde-600 shrink-0" />
                    <div>
                      <p className="text-small font-medium text-ink">{shown.offer.text}</p>
                      {shown.offer.expiry && (
                        <p className="text-meta text-ink-soft/75 mt-[2px]">
                          Vigente hasta {formatDate(shown.offer.expiry)}
                        </p>
                      )}
                    </div>
                  </div>
                </Section>
              )}

              {gallery.length > 0 && (
                <Section label="Galería">
                  <div className="grid grid-cols-3 gap-gap-xs">
                    {gallery.map((photo, i) => (
                      <div
                        key={`${photo.url}-${i}`}
                        className="relative aspect-square overflow-hidden rounded-xl bg-sand-deep"
                      >
                        <Image
                          src={photo.url}
                          alt={photo.alt ?? `Foto de ${shown.name}`}
                          fill
                          sizes="(min-width: 640px) 170px, 30vw"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </div>

          {/* Acciones: las mismas de la lista, para decidir sin cerrar el
              detalle. Firmes en el pie, no flotan con el scroll. */}
          <div className="flex items-center gap-gap-sm border-t border-ink/5 px-gap-md py-gap-sm shrink-0">
            <button
              type="button"
              onClick={() => onReject(shown.id, shown.name)}
              className="flex-1 inline-flex items-center justify-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md py-[10px] font-lv-display text-small font-semibold text-ink-soft/75 transition-colors duration-500 ease-outquint hover:border-destructive hover:text-destructive"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={() => onApprove(shown.id, shown.name)}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-gap-xs rounded-full bg-verde-500 px-gap-md py-[10px]",
                "font-lv-display text-small font-semibold text-white",
                "shadow-[0_16px_30px_-12px_rgba(53,175,109,0.75)] transition-colors duration-500 ease-outquint hover:bg-verde-600",
              )}
            >
              <CheckCircle2 size={16} strokeWidth={1.8} />
              Aprobar
            </button>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
