"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Utensils,
  Clock,
  Star,
  Layers,
  MapPin,
  CreditCard,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn, currencyLabel } from "@/lib/utils";
import { isSaved as isPlaceSaved, recordVisit, toggleSaved } from "@/lib/activity-store";
import { PhotoCarousel, type Slide } from "./photo-carousel";
import { InfoBar } from "./info-bar";
import { ActionButtons } from "./action-buttons";
import { MenuItem } from "./menu-item";
import { OfferBanner } from "./offer-banner";
import { ReviewDialog } from "./review-dialog";
import { ReviewsSection } from "./reviews-section";
import { Reveal } from "@/components/ui/reveal";

export type PlaceState = "normal" | "closed" | "no-photos" | "special-offer";

interface PlaceMenu {
  name: string;
  description: string;
  /** Texto libre. Ver `UserPlaceMenuItem`: no es un número. */
  price: string;
  currency: string;
  tag?: string;
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
  /* Con esto se compone la tarjeta de recomendación. Son datos que la ficha no
     enseña en ningún otro sitio: el ambiente, el precio y las etiquetas. */
  vibe: string[];
  aiTags: string[];
  priceLabel?: string;
  isBoosted?: boolean;
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

/* Mismo botón secundario que el resto del sistema —el `BTN_OUTLINE` del panel
   de negocio y del formulario de alta—. Antes estos dos eran texto verde suelto
   sin forma ni área: ni se veían como algo tocable, ni llegaban a los 44 px de
   alto que pide un dedo. */
const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-gap-xs h-11 px-gap-lg rounded-full border border-ink/10 bg-white text-ink font-lv-display text-small font-semibold cursor-pointer hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 transition-all duration-500 ease-outquint active:scale-[0.98]";

/* El chevron acompaña al botón sin robarle el foco: mismo trazo que el resto de
   los iconos de la ficha. */
const CHEVRON = "transition-transform duration-500 ease-outquint";

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
  /* El diálogo vive aquí y no dentro de `ActionButtons` porque hay dos rejillas
     —la de escritorio y la de móvil— montadas a la vez: dentro habría dos
     diálogos, y dos estados de nota distintos para la misma opinión. */
  const [reviewOpen, setReviewOpen] = useState(false);
  /* Cuenta las reseñas publicadas. La lista la lee y la usa como señal para
     releer: sin esto, quien acaba de opinar cerraría el diálogo y seguiría sin
     ver la suya. */
  const [reviewsKey, setReviewsKey] = useState(0);

  /* Abrir la ficha es la visita. Se cuenta aquí y no en cada página porque por
     este componente pasan todas: la ficha de `/place/[id]` y la que abre el
     panel del home. El store ignora la repetición dentro de una ventana corta,
     que es lo que evita que el doble montaje —panel y hoja— cuente doble. */
  useEffect(() => {
    recordVisit({ id: place.id, name: place.name, category: place.category });
  }, [place.id, place.name, place.category]);

  /* El estado de guardado se lee en efecto y no en el inicializador: en el
     servidor no hay `localStorage`, así que arrancar de ahí daría un HTML
     distinto al del cliente y React se quejaría al hidratar. */
  useEffect(() => {
    setSaved(isPlaceSaved(place.id));
  }, [place.id]);

  const isClosed = state === "closed" || (!place.isOpen && state !== "special-offer");
  const hasPhotos = state !== "no-photos" && place.slides.length > 0;
  const showOffer = state === "special-offer" && place.specialOffer;

  /* `distance` es un cajón de sastre: trae la distancia, la dirección o el
     barrio, lo que haya. El barrio se pinta por su cuenta, así que aquí solo
     queda lo que no sea ya el barrio. Sin esta guarda la línea decía
     "Centro Habana · Centro Habana", y en móvil además repetía la celda del
     `InfoBar`. */
  const location = place.distance === place.barrio ? "" : place.distance;

  function handleSave() {
    setSaved(toggleSaved(place.id));
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
        {/* La barra superior navega; las acciones viven en su rejilla, más abajo.
            Aquí había además un "Compartir" —el mismo botón que el de la rejilla,
            los dos sin destino— y un "Más opciones" sin handler ninguno. */}
        <span className="font-lv-display text-small font-semibold text-ink flex-1 truncate">
          {place.name}
        </span>
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
            <span className="font-lv-display font-medium text-ink">
              {location ? `${location} · ${place.barrio}` : place.barrio}
            </span>
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
            <ActionButtons
              isSaved={saved}
              onSave={handleSave}
              onNavigate={onNavigate}
              onShare={onShare}
              onReview={() => setReviewOpen(true)}
            />

            <WhyCard place={place} />

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
                  aria-expanded={descExpanded}
                  className={cn(BTN_OUTLINE, "mt-gap-md")}
                >
                  {descExpanded ? "Leer menos" : "Leer más"}
                  <ChevronDown
                    size={16}
                    strokeWidth={1.8}
                    className={cn(CHEVRON, descExpanded && "rotate-180")}
                  />
                </button>
              </section>
            </Reveal>

            {/* Menu Section (grid 2 cols on desktop) */}
            <Reveal>
              <section className={CARD}>
                <div className="flex items-center justify-between mb-gap-md">
                  {/* «Menú» solo valía para restaurantes. En la app hay mercados,
                    mipymes y vendedores independientes, y lo que enseñan es un
                    producto o un servicio, no un plato. */}
                <h2 className={H2}>Lo que ofrece</h2>
                  <button
                    type="button"
                    onClick={onMenuSeeAll}
                    className={cn(BTN_OUTLINE, "group")}
                  >
                    Ver todo
                    <ChevronRight
                      size={16}
                      strokeWidth={1.8}
                      className={cn(CHEVRON, "group-hover:translate-x-[2px]")}
                    />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-gap-lg">
                  {place.menu.map((item, i) => (
                    <MenuItem key={i} index={i} {...item} />
                  ))}
                </div>
              </section>
            </Reveal>

            {/* Reviews */}
            <Reveal>
              <section className={CARD}>
                <ReviewsSection placeId={place.id} reloadKey={reviewsKey} />
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
                {/* El barrio lo dice la celda del `InfoBar`, justo debajo; aquí
                    va la dirección, y solo cuando no es ya ese barrio. */}
                {location && (
                  <span className="inline-flex items-center gap-[4px] text-meta text-ink-soft/75">
                    <MapPin size={14} strokeWidth={1.8} className="text-verde-600" />
                    {location}
                  </span>
                )}
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
                {/* El chip de arriba ya dice "Cerrado". Repetirlo aquí dejaba
                    la línea en "Cerrado ahora · Cerrado temporalmente." */}
                <div className="text-small text-ink leading-snug">{place.closedMessage}</div>
              </div>
            </Reveal>
          )}

          {/* Info Bar */}
          <Reveal delay={0.05}>
            <InfoBar
              schedule={place.schedule}
              barrio={place.barrio}
              payments={place.payments}
            />
          </Reveal>

          {/* Action Buttons */}
          <Reveal delay={0.05}>
            <ActionButtons
              isSaved={saved}
              onSave={handleSave}
              onNavigate={onNavigate}
              onShare={onShare}
              onReview={() => setReviewOpen(true)}
            />
          </Reveal>

          {/* Divider */}
          <div className="h-[8px] bg-sand-deep" />

          {/* AI Recommendation */}
          <Reveal>
            <WhyCard place={place} className="mx-gutter my-gap-md" />
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
                aria-expanded={descExpanded}
                className={cn(BTN_OUTLINE, "mt-gap-md")}
              >
                {descExpanded ? "Leer menos" : "Leer más"}
                <ChevronDown
                  size={16}
                  strokeWidth={1.8}
                  className={cn(CHEVRON, descExpanded && "rotate-180")}
                />
              </button>
            </section>
          </Reveal>

          {/* Divider */}
          <div className="h-[8px] bg-sand-deep" />

          {/* Reviews */}
          <Reveal>
            <section className="p-gap-lg px-gutter bg-sand-warm">
              <ReviewsSection placeId={place.id} reloadKey={reviewsKey} />
            </section>
          </Reveal>

          {/* Mobile Menu Section */}
          <div className="h-[8px] bg-sand-deep" />
          <Reveal>
            <section className="p-gap-lg px-gutter bg-sand-warm">
              <div className="flex items-center justify-between mb-gap-md">
                {/* «Menú» solo valía para restaurantes. En la app hay mercados,
                    mipymes y vendedores independientes, y lo que enseñan es un
                    producto o un servicio, no un plato. */}
                <h2 className={H2}>Lo que ofrece</h2>
                <button
                  type="button"
                  onClick={onMenuSeeAll}
                  className={cn(BTN_OUTLINE, "group")}
                >
                  Ver todo
                  <ChevronRight
                    size={16}
                    strokeWidth={1.8}
                    className={cn(CHEVRON, "group-hover:translate-x-[2px]")}
                  />
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

      {/* Va al final y fuera de los dos bloques de maquetación: es uno solo para
          la ficha entera, se abra desde donde se abra. */}
      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        placeId={place.id}
        placeName={place.name}
        onPublished={() => setReviewsKey((k) => k + 1)}
      />
    </div>
  );
}

/**
 * Por qué La Verde lo recomienda. Sale en el escritorio (columna lateral) y en
 * móvil (a lo ancho); el marcado es el mismo y solo cambian los márgenes, que
 * entran por `className`.
 *
 * El texto se compone con lo que la ficha sabe de verdad del negocio. Antes
 * decía «Buscaste "buscar restaurante en Cuba"» —una consulta fabricada que
 * nadie escribió— y una razón que venía de un campo sin columna en la base, así
 * que salía siempre el mismo relleno: «listo para ser recomendado».
 *
 * Lo que se dice aquí es lo que no se ve en ninguna otra parte de la ficha: el
 * horario está en el `InfoBar`, la nota en la cabecera y la dirección en su
 * línea. Repetirlos sería volver a lo de antes.
 */
function WhyCard({ place, className }: { place: PlaceData; className?: string }) {
  const lines = [
    `${place.category} en ${place.barrio}`,
    place.priceLabel ? `Precios de ${place.priceLabel}` : null,
  ].filter((line): line is string => line !== null);

  /* `Set` porque el mismo valor puede llegar por los dos lados: la siembra mete
     «Todo el día» en `vibe` y el negocio puede tenerlo también en sus etiquetas. */
  const chips = [
    ...new Set([
      ...(place.isBoosted ? ["Destacado"] : []),
      ...place.vibe,
      ...place.aiTags,
    ]),
  ];

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
          <div className="text-meta text-ink-soft/75">Datos del lugar</div>
        </div>
      </div>

      <div className="text-small leading-relaxed text-ink text-pretty">
        {lines.join(". ")}.
      </div>

      {chips.length > 0 && (
        <div className="flex gap-[6px] flex-wrap mt-gap-sm">
          {chips.map((tag) => (
            <span
              key={tag}
              className="px-[8px] py-[3px] rounded-full bg-white border border-verde-200 font-lv-display text-[10px] font-semibold text-verde-600 uppercase tracking-[0.08em]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
