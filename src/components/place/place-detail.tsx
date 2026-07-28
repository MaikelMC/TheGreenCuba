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
  MessageCircle,
  ChevronRight,
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
  className?: string;
}

export function PlaceDetail({
  place,
  state = "normal",
  onBack,
  onShare,
  onMenuSeeAll,
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

      {/* ─── Content ─── */}
      <div className="lg:max-w-container lg:mx-auto lg:px-gutter-lg lg:py-gap-xl">
        <div className="lg:grid lg:grid-cols-[1fr_420px] lg:gap-gap-lg lg:items-start">
          {/* ── Left Column ── */}
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
                <span className="inline-flex items-center gap-[4px] font-mono text-meta font-medium text-foreground">
                  <Star size={14} strokeWidth={2} className="text-lv-amber" fill="currentColor" />
                  {place.rating}
                </span>
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
            <div className="h-[8px] bg-background lg:hidden" />

            {/* AI Recommendation */}
            <div className="mx-gutter my-gap-md p-gap-md bg-gradient-to-br from-accent/[0.06] to-accent/[0.02] border border-accent/15 rounded-lv-lg lg:mx-0">
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
            <section className="p-gap-lg px-gutter bg-surface lg:rounded-lv-lg lg:border lg:border-border lg:p-gap-xl">
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
            <div className="h-[8px] bg-background lg:hidden" />

            {/* Reviews (future) */}
            <section className="p-gap-lg px-gutter bg-surface lg:rounded-lv-lg lg:border lg:border-border lg:p-gap-xl">
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
          </div>

          {/* ── Right Column (Desktop) ── */}
          <div className="hidden lg:flex flex-col gap-gap-md lg:sticky lg:top-[calc(60px+var(--gap-lg))]">
            <div className="h-[1px] bg-border" />

            {/* Menu Section */}
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
              {place.menu.map((item, i) => (
                <MenuItem key={i} {...item} />
              ))}
            </section>
          </div>

          {/* ── Mobile Menu Section (below reviews) ── */}
          <div className="lg:hidden">
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
          </div>
        </div>
      </div>

      {/* Bottom safe area */}
      <div className="pb-safe-bottom bg-surface" />
    </div>
  );
}
