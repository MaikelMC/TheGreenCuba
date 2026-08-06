"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { PhotoCarousel } from "./photo-carousel";
import { InfoBar } from "./info-bar";
import { ActionButtons } from "./action-buttons";
import { MenuItem } from "./menu-item";
import { OfferBanner } from "./offer-banner";

export type PlaceState = "normal" | "closed" | "no-photos" | "special-offer";

interface PlaceMenu {
  name: string;
  description: string;
  price: number;
  currency: string;
  tag?: { label: string; variant: "popular" | "new" | "offer" };
  imageEmoji?: string;
}

interface PlacePhoto {
  gradient: string;
  label: string;
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
  slides: PlacePhoto[];
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
  footerSlot?: React.ReactNode;
  className?: string;
}

const currencyStyles: Record<string, string> = {
  MLC: "bg-accent/12 text-accent",
  CUP: "bg-lv-blue/10 text-lv-blue",
  USD: "bg-lv-teal/10 text-lv-teal",
};

export function PlaceDetail({
  place,
  state = "normal",
  onBack,
  onShare,
  onMenuSeeAll,
  footerSlot,
  className,
}: PlaceDetailProps) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [saved, setSaved] = useState(true);

  const isClosed = state === "closed" || (!place.isOpen && state !== "special-offer");
  const hasPhotos = state !== "no-photos" && place.slides.length > 0;
  const showOffer = state === "special-offer" && place.specialOffer;

  function handleSave() {
    setSaved((prev) => !prev);
  }

  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 h-header bg-surface/92 backdrop-blur border-b border-border flex items-center gap-gap-sm px-gutter">
        <button
          type="button"
          onClick={onBack}
          className="size-10 rounded-full grid place-items-center hover:bg-accent/10 transition-colors duration-fast"
          aria-label="Volver al mapa"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <span className="font-display text-small font-semibold text-foreground flex-1 truncate">
          {place.name}
        </span>
        <div className="flex gap-[4px]">
          <button
            type="button"
            onClick={onShare}
            className="size-10 rounded-full grid place-items-center hover:bg-accent/10 transition-colors duration-fast"
            aria-label="Compartir"
          >
            <Share2 size={20} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="size-10 rounded-full grid place-items-center hover:bg-accent/10 transition-colors duration-fast"
            aria-label="Más opciones"
          >
            <MoreHorizontal size={20} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* ────────── Desktop Layout ────────── */}
      <div className="hidden lg:block lg:max-w-container lg:mx-auto lg:px-gutter-lg lg:py-gap-xl">
        {/* Row 1: Photo Carousel (full width) with place name overlay */}
        <div className="relative mb-gap-lg">
          <PhotoCarousel
            slides={place.slides}
            hasPhotos={hasPhotos}
            className="aspect-[16/9] rounded-lv-xl overflow-hidden"
          />
          <div className="absolute bottom-0 left-0 right-0 p-gap-xl bg-gradient-to-t from-black/70 via-black/30 to-transparent rounded-b-lv-xl pointer-events-none">
            <h1 className="font-display text-h1 font-bold text-white leading-tight tracking-[-0.02em] text-balance">
              {place.name}
            </h1>
            <div className="flex items-center gap-gap-sm mt-gap-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-[4px] px-[10px] py-[4px] rounded-full font-mono text-xs font-medium uppercase tracking-[0.04em]",
                  isClosed
                    ? "bg-destructive/20 text-destructive-foreground"
                    : "bg-white/20 text-white",
                )}
              >
                <span
                  className={cn(
                    "size-[6px] rounded-full",
                    isClosed ? "bg-destructive" : "bg-white",
                  )}
                />
                {isClosed ? "Cerrado" : "Abierto"}
              </span>
              {place.rating > 0 && (
                <span className="inline-flex items-center gap-[4px] font-mono text-xs font-medium text-white/80">
                  <Star size={12} strokeWidth={2} className="text-lv-amber" fill="currentColor" />
                  {place.rating}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Info Strip (compact) */}
        <div className="flex items-center gap-gap-lg mb-gap-lg px-gap-md">
          <div className="flex items-center gap-gap-xs text-meta text-muted-foreground">
            <Clock size={14} strokeWidth={2} className="text-accent" />
            <span className="font-medium text-foreground">{place.schedule}</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-gap-xs text-meta text-muted-foreground">
            <MapPin size={14} strokeWidth={2} className="text-accent" />
            <span className="font-medium text-foreground">{place.distance} · {place.barrio}</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-[4px] text-meta text-muted-foreground">
            <CreditCard size={14} strokeWidth={2} className="text-accent" />
            {place.payments.map((c) => (
              <span
                key={c}
                className={cn(
                  "px-[5px] py-[1px] rounded-sm font-mono text-[10px] font-medium tracking-[0.02em]",
                  currencyStyles[c] ?? "bg-muted text-muted-foreground",
                )}
              >
                {c}
              </span>
            ))}
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-gap-xs text-meta text-muted-foreground">
            <Utensils size={14} strokeWidth={2} className="text-accent" />
            <span className="font-medium text-foreground">{place.category}</span>
          </div>
        </div>

        {/* Row 3: Two columns */}
        <div className="grid grid-cols-[350px_1fr] gap-gap-lg items-start">
          {/* ── Left Column (sticky sidebar) ── */}
          <div className="sticky top-[calc(var(--header-h)+var(--gap-lg))] flex flex-col gap-gap-md">
            <ActionButtons isSaved={saved} onSave={handleSave} />

            {/* AI Recommendation */}
            <div className="bg-gradient-to-br from-accent/[0.06] to-accent/[0.02] border border-accent/15 rounded-lv-lg p-gap-lg">
              <div className="flex items-center gap-gap-sm mb-gap-sm">
                <div className="size-9 rounded-lv bg-accent grid place-items-center shrink-0">
                  <Layers size={18} strokeWidth={2} className="text-white" />
                </div>
                <div>
                  <div className="font-display text-small font-bold text-foreground">
                    Por qué La Verde te lo recomienda
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Basado en tu búsqueda y ubicación
                  </div>
                </div>
              </div>
              <div className="text-small leading-relaxed text-foreground">
                Buscaste <strong>&ldquo;{place.aiQuery}&rdquo;</strong>. {place.aiReasoning}
              </div>
              <div className="flex gap-[6px] flex-wrap mt-gap-sm">
                {place.aiTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-[8px] py-[3px] rounded-full bg-white/70 border border-accent/12 font-mono text-[10px] font-medium text-accent uppercase tracking-[0.04em]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Special Offer */}
            {showOffer && place.specialOffer && (
              <OfferBanner
                label={place.specialOffer.label}
                text={place.specialOffer.text}
                expiry={place.specialOffer.expiry}
                visible
              />
            )}
          </div>

          {/* ── Right Column (main content) ── */}
          <div className="flex flex-col gap-gap-lg">
            {/* Description */}
            <section className="bg-surface rounded-lv-lg border border-border p-gap-xl">
              <h2 className="font-display text-h3 font-bold text-foreground mb-gap-sm">
                Sobre este lugar
              </h2>
              <p
                className={cn(
                  "text-body leading-relaxed text-foreground text-pretty",
                  !descExpanded && "line-clamp-3",
                )}
              >
                {place.longDescription}
              </p>
              <button
                type="button"
                onClick={() => setDescExpanded((prev) => !prev)}
                className="font-mono text-xs font-medium text-accent uppercase tracking-[0.04em] mt-gap-xs py-[4px] hover:text-accent-hover transition-colors"
              >
                {descExpanded ? "Leer menos" : "Leer más"}
              </button>
            </section>

            {/* Menu Section (grid 2 cols on desktop) */}
            <section className="bg-surface rounded-lv-lg border border-border p-gap-xl">
              <div className="flex items-center justify-between mb-gap-md">
                <h2 className="font-display text-h3 font-bold text-foreground">Menú destacado</h2>
                <button
                  type="button"
                  onClick={onMenuSeeAll}
                  className="font-mono text-xs font-medium text-accent uppercase tracking-[0.04em] hover:text-accent-hover transition-colors"
                >
                  Ver todo
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-gap-lg">
                {place.menu.map((item, i) => (
                  <MenuItem key={i} {...item} className="border-b border-border last:border-b-0" />
                ))}
              </div>
            </section>

            {/* Reviews (placeholder) */}
            <section className="bg-surface rounded-lv-lg border border-border p-gap-xl">
              <div className="flex items-center justify-between mb-gap-md">
                <h2 className="font-display text-h3 font-bold text-foreground">Reseñas</h2>
                <span className="font-mono text-meta text-muted-foreground">Próximamente</span>
              </div>
              <div className="text-center py-gap-xl px-gap-md border border-dashed border-border rounded-lv-lg">
                <MessageSquare
                  size={48}
                  strokeWidth={1.5}
                  className="mx-auto mb-gap-sm text-muted-foreground opacity-40"
                />
                <div className="font-display text-small font-semibold text-foreground mb-[4px]">
                  Las reseñas llegarán pronto
                </div>
                <div className="text-meta text-muted-foreground">
                  Podrás calificar y dejar tu opinión tras visitar el lugar
                </div>
              </div>
            </section>

            {footerSlot}
          </div>
        </div>
      </div>

      {/* ────────── Mobile Layout ────────── */}
      <div className="lg:hidden">
        <div className="flex flex-col gap-0">
          {/* Photo Carousel */}
          <PhotoCarousel slides={place.slides} hasPhotos={hasPhotos} />

          {/* Place Info */}
          <section className="p-gap-lg px-gutter bg-surface">
            <div className="flex items-start justify-between gap-gap-sm mb-gap-sm">
              <h1 className="font-display text-h2 font-bold leading-tight tracking-[-0.015em] text-foreground text-balance">
                {place.name}
              </h1>
              <span
                className={cn(
                  "shrink-0 inline-flex items-center gap-[4px] px-[10px] py-[4px] rounded-full font-mono text-xs font-medium uppercase tracking-[0.04em]",
                  isClosed
                    ? "bg-destructive/10 text-destructive"
                    : "bg-lv-teal/12 text-lv-teal",
                )}
              >
                <span
                  className={cn(
                    "size-[6px] rounded-full",
                    isClosed ? "bg-destructive" : "bg-lv-teal",
                  )}
                />
                {isClosed ? "Cerrado" : "Abierto"}
              </span>
            </div>
            <div className="flex items-center gap-gap-sm flex-wrap">
              <span className="inline-flex items-center gap-[4px] px-[10px] py-[3px] rounded-full bg-accent/10 text-accent font-mono text-xs font-medium uppercase tracking-[0.03em]">
                <Utensils size={12} strokeWidth={2} />
                {place.category}
              </span>
              {place.rating > 0 && (
                <span className="inline-flex items-center gap-[4px] font-mono text-meta font-medium text-foreground">
                  <Star size={14} strokeWidth={2} className="text-lv-amber" fill="currentColor" />
                  {place.rating}
                </span>
              )}
              <span className="text-xs text-muted-foreground italic">Próximamente en La Verde</span>
              <span className="font-mono text-meta text-muted-foreground">
                {place.distance} · {place.barrio}
              </span>
            </div>
          </section>

          {/* Closed Banner */}
          {isClosed && place.closedMessage && (
            <div className="mx-gutter mb-gap-md p-gap-md bg-destructive/6 border border-destructive/15 rounded-lv-lg flex items-center gap-gap-sm">
              <div className="size-9 rounded-lv bg-destructive/10 grid place-items-center shrink-0">
                <Clock size={18} strokeWidth={2} className="text-destructive" />
              </div>
              <div className="text-small text-foreground leading-snug">
                <strong>Cerrado ahora</strong> · {place.closedMessage}
              </div>
            </div>
          )}

          {/* Info Bar */}
          <InfoBar
            schedule={place.schedule}
            distance={place.distance}
            payments={place.payments}
            isOpen={!isClosed}
            closedLabel="Cerrado"
          />

          {/* Action Buttons */}
          <ActionButtons
            isSaved={saved}
            onSave={handleSave}
          />

          {/* Divider */}
          <div className="h-[8px] bg-background" />

          {/* AI Recommendation */}
          <div className="mx-gutter my-gap-md p-gap-md bg-gradient-to-br from-accent/[0.06] to-accent/[0.02] border border-accent/15 rounded-lv-lg">
            <div className="flex items-center gap-gap-sm mb-gap-sm">
              <div className="size-9 rounded-lv bg-accent grid place-items-center shrink-0">
                <Layers size={18} strokeWidth={2} className="text-white" />
              </div>
              <div>
                <div className="font-display text-small font-bold text-foreground">
                  Por qué La Verde te lo recomienda
                </div>
                <div className="text-xs text-muted-foreground">
                  Basado en tu búsqueda y ubicación
                </div>
              </div>
            </div>
            <div className="text-small leading-relaxed text-foreground">
              Buscaste <strong>&ldquo;{place.aiQuery}&rdquo;</strong>. {place.aiReasoning}
            </div>
            <div className="flex gap-[6px] flex-wrap mt-gap-sm">
              {place.aiTags.map((tag) => (
                <span
                  key={tag}
                  className="px-[8px] py-[3px] rounded-full bg-white/70 border border-accent/12 font-mono text-[10px] font-medium text-accent uppercase tracking-[0.04em]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Special Offer Banner */}
          {showOffer && place.specialOffer && (
            <OfferBanner
              label={place.specialOffer.label}
              text={place.specialOffer.text}
              expiry={place.specialOffer.expiry}
              visible
            />
          )}

          {/* Description */}
          <section className="p-gap-lg px-gutter bg-surface">
            <h2 className="font-display text-h3 font-bold text-foreground mb-gap-sm">
              Sobre este lugar
            </h2>
            <p
              className={cn(
                "text-body leading-relaxed text-foreground text-pretty",
                !descExpanded && "line-clamp-3",
              )}
            >
              {place.longDescription}
            </p>
            <button
              type="button"
              onClick={() => setDescExpanded((prev) => !prev)}
              className="font-mono text-xs font-medium text-accent uppercase tracking-[0.04em] mt-gap-xs py-[4px] hover:text-accent-hover transition-colors"
            >
              {descExpanded ? "Leer menos" : "Leer más"}
            </button>
          </section>

          {/* Divider */}
          <div className="h-[8px] bg-background" />

          {/* Reviews (future) */}
          <section className="p-gap-lg px-gutter bg-surface">
            <div className="flex items-center justify-between mb-gap-md">
              <h2 className="font-display text-h3 font-bold text-foreground">Reseñas</h2>
              <span className="font-mono text-meta text-muted-foreground">Próximamente</span>
            </div>
            <div className="text-center py-gap-xl px-gap-md border border-dashed border-border rounded-lv-lg">
              <MessageSquare
                size={48}
                strokeWidth={1.5}
                className="mx-auto mb-gap-sm text-muted-foreground opacity-40"
              />
              <div className="font-display text-small font-semibold text-foreground mb-[4px]">
                Las reseñas llegarán pronto
              </div>
              <div className="text-meta text-muted-foreground">
                Podrás calificar y dejar tu opinión tras visitar el lugar
              </div>
            </div>
          </section>

          {/* Mobile Menu Section */}
          <div className="h-[8px] bg-background" />
          <section className="p-gap-lg px-gutter bg-surface">
            <div className="flex items-center justify-between mb-gap-md">
              <h2 className="font-display text-h3 font-bold text-foreground">Menú destacado</h2>
              <button
                type="button"
                onClick={onMenuSeeAll}
                className="font-mono text-xs font-medium text-accent uppercase tracking-[0.04em]"
              >
                Ver todo
              </button>
            </div>
            {place.menu.map((item, i) => (
              <MenuItem key={i} {...item} />
            ))}
          </section>

          {footerSlot}
        </div>
      </div>

      {/* Bottom safe area */}
      <div className="pb-safe-bottom bg-surface" />
    </div>
  );
}
