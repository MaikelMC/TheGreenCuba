"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Share2,
  MoreHorizontal,
  Utensils,
  Clock,
  Star,
  Layers,
  MapPin,
  CreditCard,
  MessageSquare,
} from "lucide-react";
import { cn, currencyLabel } from "@/lib/utils";
import { isSaved as isPlaceSaved, recordVisit, toggleSaved } from "@/lib/activity-store";
import { PhotoCarousel, type Slide } from "./photo-carousel";
import { InfoBar } from "./info-bar";
import { ActionButtons } from "./action-buttons";
import { MenuItem } from "./menu-item";
import { OfferBanner } from "./offer-banner";
import { Reveal } from "@/components/ui/reveal";
import { StateView } from "@/components/ui/state-view";

export type PlaceState = "normal" | "closed" | "no-photos" | "special-offer";

interface PlaceMenu {
  name: string;
  description: string;
  price: number;
  currency: string;
  tag?: { label: string; variant: "popular" | "new" | "offer" };
  imageEmoji?: string;
}

export interface PlaceData {
  id: string;
  name: string;
  category: string;
  rating: number;
  distance: string;
  barrio: string;
  schedule: string;
  payments: string[];
  description: string;
  longDescription: string;
  isOpen: boolean;
  closedMessage?: string;
  aiQuery: string;
  aiReasoning: string;
  aiTags: string[];
  slides: Slide[];
  menu: PlaceMenu[];
  specialOffer?: {
    label: string;
    text: string;
    expiry: string;
  };
}

interface PlaceDetailProps {
  place: PlaceData;
  state?: PlaceState;
  onBack?: () => void;
  onShare?: () => void;
  onMenuSeeAll?: () => void;
  onNavigate?: () => void;
  footerSlot?: React.ReactNode;
  className?: string;
}

/* Mismo mapa que los chips de pago del panel de negocio. Antes eran lv-blue y
   lv-teal, que no son del sistema. */
const currencyStyles: Record<string, string> = {
  MLC: "bg-verde-100 text-verde-700",
  CUP: "bg-verde-50 text-verde-600",
  USD: "bg-sand-deep text-ink-soft/75",
  EUR: "bg-sand-deep text-ink-soft/75",
};

const CARD = "bg-white rounded-2xl border border-ink/5 shadow-soft p-gap-xl";
const H2 = "font-lv-display text-h3 font-bold text-ink";
const LINK_BTN =
  "font-lv-display text-meta font-semibold uppercase tracking-[0.08em] text-verde-600 hover:text-verde-700 transition-colors duration-500 ease-outquint";

export function PlaceDetail({
  place,
  state = "normal",
  onBack,
  onShare,
  onMenuSeeAll,
  onNavigate,
  footerSlot,
  className,
}: PlaceDetailProps) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data: { authenticated: boolean; user: { id?: string } | null }) => {
        if (data.authenticated && data.user?.id) setUserId(data.user.id);
      })
      .catch(() => {});
  }, []);

  /* Abrir la ficha es la visita. Se cuenta aquí y no en cada página porque por
     este componente pasan todas: la ficha de `/place/[id]` y la que abre el
     panel del home. El store ignora la repetición dentro de una ventana corta,
     que es lo que evita que el doble montaje —panel y hoja— cuente doble. */
  useEffect(() => {
    recordVisit({ id: place.id, name: place.name, category: place.category }, userId);
  }, [place.id, place.name, place.category, userId]);

  /* El estado de guardado se lee en efecto y no en el inicializador: en el
     servidor no hay `localStorage`, así que arrancar de ahí daría un HTML
     distinto al del cliente y React se quejaría al hidratar. */
  useEffect(() => {
    setSaved(isPlaceSaved(place.id, userId));
  }, [place.id, userId]);

  const isClosed = state === "closed" || (!place.isOpen && state !== "special-offer");
  const hasPhotos = state !== "no-photos" && place.slides.length > 0;
  const showOffer = state === "special-offer" && place.specialOffer;

  function handleSave() {
    setSaved(toggleSaved(place.id, userId));
  }

  // Aquí va `min-h-dvh` solo: `cn` usa twMerge, que colapsaría el par
  // min-h-screen/min-h-dvh y se quedaría con el último igualmente.
  return (
    <div className={cn("min-h-dvh bg-sand font-lv text-ink", className)}>
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 h-header bg-sand-warm/90 backdrop-blur-[16px] border-b border-ink/5 flex items-center gap-gap-sm px-gutter">
        <button
          type="button"
          onClick={onBack}
          className="size-10 rounded-full grid place-items-center text-ink-soft/75 hover:bg-verde-50 hover:text-verde-600 transition-colors duration-500 ease-outquint"
          aria-label="Volver al mapa"
        >
          <ArrowLeft size={20} strokeWidth={1.8} />
        </button>
        <span className="font-lv-display text-small font-semibold text-ink flex-1 truncate">
          {place.name}
        </span>
        <div className="flex gap-[4px]">
          <button
            type="button"
            onClick={onShare}
            className="size-10 rounded-full grid place-items-center text-ink-soft/75 hover:bg-verde-50 hover:text-verde-600 transition-colors duration-500 ease-outquint"
            aria-label="Compartir"
          >
            <Share2 size={20} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="size-10 rounded-full grid place-items-center text-ink-soft/75 hover:bg-verde-50 hover:text-verde-600 transition-colors duration-500 ease-outquint"
            aria-label="Más opciones"
          >
            <MoreHorizontal size={20} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {/* ────────── Desktop Layout ────────── */}
      <div className="hidden lg:block lg:max-w-container lg:mx-auto lg:px-gutter-lg lg:py-gap-xl">
        {/* Row 1: Photo Carousel (full width) with place name overlay */}
        <Reveal className="relative mb-gap-lg">
          <PhotoCarousel
            slides={place.slides}
            hasPhotos={hasPhotos}
            className="aspect-[16/9] rounded-4xl overflow-hidden"
          />
          <div className="absolute bottom-0 left-0 right-0 p-gap-xl bg-gradient-to-t from-ink/85 via-ink/40 to-transparent rounded-b-4xl pointer-events-none">
            <h1 className="font-lv-display text-h1 font-bold text-white leading-tight tracking-[-0.02em] text-balance">
              {place.name}
            </h1>
            <div className="flex items-center gap-gap-sm mt-gap-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-[4px] px-[10px] py-[4px] rounded-full font-lv-display text-xs font-semibold uppercase tracking-[0.06em]",
                  isClosed
                    ? "bg-destructive/90 text-white"
                    : "bg-verde-400 text-verde-950",
                )}
              >
                <span
                  className={cn(
                    "size-[6px] rounded-full",
                    isClosed ? "bg-white/80" : "bg-verde-950/60",
                  )}
                />
                {isClosed ? "Cerrado" : "Abierto"}
              </span>
              {place.rating > 0 && (
                <span className="inline-flex items-center gap-[4px] font-lv-display text-xs font-semibold text-white/80">
                  <Star size={12} strokeWidth={1.8} className="text-verde-300" fill="currentColor" />
                  {place.rating}
                </span>
              )}
            </div>
          </div>
        </Reveal>

        {/* Row 2: Info Strip (compact) */}
        <Reveal delay={0.05} className="flex items-center gap-gap-lg mb-gap-lg px-gap-md">
          <div className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
            <Clock size={14} strokeWidth={1.8} className="text-verde-600" />
            <span className="font-lv-display font-medium text-ink">{place.schedule}</span>
          </div>
          <span className="text-ink/10">|</span>
          <div className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
            <MapPin size={14} strokeWidth={1.8} className="text-verde-600" />
            <span className="font-lv-display font-medium text-ink">{place.distance} · {place.barrio}</span>
          </div>
          <span className="text-ink/10">|</span>
          <div className="flex items-center gap-[4px] text-meta text-ink-soft/75">
            <CreditCard size={14} strokeWidth={1.8} className="text-verde-600" />
            {place.payments.map((c) => (
              <span
                key={c}
                className={cn(
                  "px-[6px] py-[2px] rounded-full font-lv-display text-[10px] font-semibold uppercase tracking-[0.08em]",
                  currencyStyles[c] ?? "bg-sand-deep text-ink-soft/75",
                )}
              >
                {currencyLabel(c)}
              </span>
            ))}
          </div>
          <span className="text-ink/10">|</span>
          <div className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
            <Utensils size={14} strokeWidth={1.8} className="text-verde-600" />
            <span className="font-lv-display font-medium text-ink">{place.category}</span>
          </div>
        </Reveal>

        {/* Row 3: Two columns */}
        <div className="grid grid-cols-[350px_1fr] gap-gap-lg items-start">
          {/* ── Left Column (sticky sidebar) ── */}
          <Reveal className="sticky top-[calc(var(--header-h)+var(--gap-lg))] flex flex-col gap-gap-md">
            <ActionButtons isSaved={saved} onSave={handleSave} onNavigate={onNavigate} />

            <AiCard place={place} />

            {/* Special Offer */}
            {showOffer && place.specialOffer && (
              <OfferBanner
                label={place.specialOffer.label}
                text={place.specialOffer.text}
                expiry={place.specialOffer.expiry}
                visible
              />
            )}
          </Reveal>

          {/* ── Right Column (main content) ── */}
          <div className="flex flex-col gap-gap-lg">
            {/* Description */}
            <Reveal>
              <section className={CARD}>
                <h2 className={cn(H2, "mb-gap-sm")}>Sobre este lugar</h2>
                <p
                  className={cn(
                    "text-body leading-relaxed text-ink text-pretty",
                    !descExpanded && "line-clamp-3",
                  )}
                >
                  {place.longDescription}
                </p>
                <button
                  type="button"
                  onClick={() => setDescExpanded((prev) => !prev)}
                  className={cn(LINK_BTN, "mt-gap-xs py-[4px]")}
                >
                  {descExpanded ? "Leer menos" : "Leer más"}
                </button>
              </section>
            </Reveal>

            {/* Menu Section (grid 2 cols on desktop) */}
            <Reveal>
              <section className={CARD}>
                <div className="flex items-center justify-between mb-gap-md">
                  <h2 className={H2}>Menú destacado</h2>
                  <button type="button" onClick={onMenuSeeAll} className={LINK_BTN}>
                    Ver todo
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-gap-lg">
                  {place.menu.map((item, i) => (
                    <MenuItem key={i} index={i} {...item} />
                  ))}
                </div>
              </section>
            </Reveal>

            {/* Reviews (placeholder) */}
            <Reveal>
              <section className={CARD}>
                <div className="flex items-center justify-between mb-gap-md">
                  <h2 className={H2}>Reseñas</h2>
                  <span className="font-lv-display text-meta text-ink-soft/75">Próximamente</span>
                </div>
                <div className="border border-dashed border-ink/10 rounded-2xl">
                  <StateView
                    icon={MessageSquare}
                    title="Las reseñas llegarán pronto"
                    description="Podrás calificar y dejar tu opinión tras visitar el lugar"
                  />
                </div>
              </section>
            </Reveal>

            {footerSlot}
          </div>
        </div>
      </div>

      {/* ────────── Mobile Layout ────────── */}
      <div className="lg:hidden">
        <div className="flex flex-col gap-0">
          {/* Photo Carousel */}
          <Reveal>
            <PhotoCarousel slides={place.slides} hasPhotos={hasPhotos} />
          </Reveal>

          {/* Place Info */}
          <Reveal delay={0.05}>
            <section className="p-gap-lg px-gutter bg-sand-warm">
              <div className="flex items-start justify-between gap-gap-sm mb-gap-sm">
                <h1 className="font-lv-display text-h2 font-bold leading-tight tracking-[-0.015em] text-ink text-balance">
                  {place.name}
                </h1>
                <span
                  className={cn(
                    "shrink-0 inline-flex items-center gap-[4px] px-[10px] py-[4px] rounded-full border font-lv-display text-xs font-semibold uppercase tracking-[0.06em]",
                    isClosed
                      ? "border-destructive/20 bg-destructive/10 text-destructive"
                      : "border-verde-200 bg-verde-50 text-verde-600",
                  )}
                >
                  <span
                    className={cn(
                      "size-[6px] rounded-full",
                      isClosed ? "bg-destructive" : "bg-verde-400",
                    )}
                  />
                  {isClosed ? "Cerrado" : "Abierto"}
                </span>
              </div>
              <div className="flex items-center gap-gap-sm flex-wrap">
                <span className="inline-flex items-center gap-[4px] px-[10px] py-[3px] rounded-full bg-verde-50 border border-verde-200 text-verde-600 font-lv-display text-xs font-semibold uppercase tracking-[0.06em]">
                  <Utensils size={12} strokeWidth={1.8} />
                  {place.category}
                </span>
                {place.rating > 0 && (
                  <span className="inline-flex items-center gap-[4px] font-lv-display text-meta font-semibold text-verde-600">
                    <Star size={14} strokeWidth={1.8} fill="currentColor" />
                    {place.rating}
                  </span>
                )}
                <span className="text-meta text-ink-soft/75 italic">Próximamente en La Verde</span>
                <span className="font-lv-display text-meta text-ink-soft/75">
                  {place.distance} · {place.barrio}
                </span>
              </div>
            </section>
          </Reveal>

          {/* Closed Banner */}
          {isClosed && place.closedMessage && (
            <Reveal delay={0.05}>
              <div className="mx-gutter mb-gap-md p-gap-md bg-destructive/5 border border-destructive/15 rounded-2xl flex items-center gap-gap-sm">
                <div className="size-9 rounded-2xl bg-destructive/10 grid place-items-center shrink-0">
                  <Clock size={18} strokeWidth={1.8} className="text-destructive" />
                </div>
                <div className="text-small text-ink leading-snug">
                  <strong>Cerrado ahora</strong> · {place.closedMessage}
                </div>
              </div>
            </Reveal>
          )}

          {/* Info Bar */}
          <Reveal delay={0.05}>
            <InfoBar
              schedule={place.schedule}
              distance={place.distance}
              payments={place.payments}
              isOpen={!isClosed}
              closedLabel="Cerrado"
            />
          </Reveal>

          {/* Action Buttons */}
          <Reveal delay={0.05}>
            <ActionButtons
              isSaved={saved}
              onSave={handleSave}
              onNavigate={onNavigate}
            />
          </Reveal>

          {/* Divider */}
          <div className="h-[8px] bg-sand-deep" />

          {/* AI Recommendation */}
          <Reveal>
            <AiCard place={place} className="mx-gutter my-gap-md" />
          </Reveal>

          {/* Special Offer Banner */}
          {showOffer && place.specialOffer && (
            <Reveal>
              <OfferBanner
                label={place.specialOffer.label}
                text={place.specialOffer.text}
                expiry={place.specialOffer.expiry}
                visible
              />
            </Reveal>
          )}

          {/* Description */}
          <Reveal>
            <section className="p-gap-lg px-gutter bg-sand-warm">
              <h2 className={cn(H2, "mb-gap-sm")}>Sobre este lugar</h2>
              <p
                className={cn(
                  "text-body leading-relaxed text-ink text-pretty",
                  !descExpanded && "line-clamp-3",
                )}
              >
                {place.longDescription}
              </p>
              <button
                type="button"
                onClick={() => setDescExpanded((prev) => !prev)}
                className={cn(LINK_BTN, "mt-gap-xs py-[4px]")}
              >
                {descExpanded ? "Leer menos" : "Leer más"}
              </button>
            </section>
          </Reveal>

          {/* Divider */}
          <div className="h-[8px] bg-sand-deep" />

          {/* Reviews (future) */}
          <Reveal>
            <section className="p-gap-lg px-gutter bg-sand-warm">
              <div className="flex items-center justify-between mb-gap-md">
                <h2 className={H2}>Reseñas</h2>
                <span className="font-lv-display text-meta text-ink-soft/75">Próximamente</span>
              </div>
              <div className="border border-dashed border-ink/10 rounded-2xl">
                <StateView
                  icon={MessageSquare}
                  title="Las reseñas llegarán pronto"
                  description="Podrás calificar y dejar tu opinión tras visitar el lugar"
                />
              </div>
            </section>
          </Reveal>

          {/* Mobile Menu Section */}
          <div className="h-[8px] bg-sand-deep" />
          <Reveal>
            <section className="p-gap-lg px-gutter bg-sand-warm">
              <div className="flex items-center justify-between mb-gap-md">
                <h2 className={H2}>Menú destacado</h2>
                <button type="button" onClick={onMenuSeeAll} className={LINK_BTN}>
                  Ver todo
                </button>
              </div>
              {place.menu.map((item, i) => (
                <MenuItem key={i} index={i} {...item} />
              ))}
            </section>
          </Reveal>

          {footerSlot}
        </div>
      </div>

      {/* Bottom safe area */}
      <div className="pb-safe-bottom bg-sand" />
    </div>
  );
}

/* La recomendación de la IA sale en el escritorio (columna lateral) y en móvil
   (a lo ancho). El marcado era idéntico en los dos sitios; solo cambiaban los
   márgenes, que entran por `className`. */
function AiCard({ place, className }: { place: PlaceData; className?: string }) {
  return (
    <div
      className={cn(
        "p-gap-md bg-verde-50 border border-verde-200 rounded-2xl",
        className,
      )}
    >
      <div className="flex items-center gap-gap-sm mb-gap-sm">
        <div className="size-9 rounded-2xl bg-gradient-to-br from-verde-400 to-verde-600 grid place-items-center shrink-0">
          <Layers size={18} strokeWidth={1.8} className="text-white" />
        </div>
        <div>
          <div className="font-lv-display text-small font-bold text-ink">
            Por qué La Verde te lo recomienda
          </div>
          <div className="text-meta text-ink-soft/75">
            Basado en tu búsqueda y ubicación
          </div>
        </div>
      </div>
      <div className="text-small leading-relaxed text-ink">
        Buscaste <strong>&ldquo;{place.aiQuery}&rdquo;</strong>. {place.aiReasoning}
      </div>
      <div className="flex gap-[6px] flex-wrap mt-gap-sm">
        {place.aiTags.map((tag) => (
          <span
            key={tag}
            className="px-[8px] py-[3px] rounded-full bg-white border border-verde-200 font-lv-display text-[10px] font-semibold text-verde-600 uppercase tracking-[0.08em]"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
