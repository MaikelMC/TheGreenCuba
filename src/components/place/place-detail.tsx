"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  CalendarDays,
  Megaphone,
  Utensils,
  Clock,
  Star,
  Layers,
  MapPin,
  CreditCard,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import { cn, currencyLabel } from "@/lib/utils";
import {
  isSaved as isPlaceSaved,
  recordVisit,
  toggleSaved,
} from "@/lib/activity-store";
import {
  readAiRecommendation,
  type AiRecommendation,
} from "@/lib/ai-recommendation-store";
import { trackPlaceSaveToggled, trackPlaceViewed } from "@/lib/analytics";
import { trackPlaceMetric } from "@/lib/place-metrics";
import { PhotoCarousel, type Slide } from "./photo-carousel";
import { InfoBar } from "./info-bar";
import { ActionButtons } from "./action-buttons";
import { MenuItem } from "./menu-item";
import { OfferBanner } from "./offer-banner";
import { ReviewDialog } from "./review-dialog";
import { ReviewsSection } from "./reviews-section";
import { Reveal } from "@/components/ui/reveal";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ProjectOfferPackage } from "@/lib/db/schema/project_requests";

export type PlaceState = "normal" | "closed" | "no-photos" | "special-offer";

interface PlaceMenu {
  name: string;
  description: string;
  /** Texto libre. Ver `UserPlaceMenuItem`: no es un número. */
  price: string;
  currency: string;
  tag?: string;
  imageEmoji?: string;
  /** URL de la foto del producto en el bucket. Si no hay, el hueco queda con
      el icono de siempre. */
  image?: string;
}

export interface PlaceData {
  id: string;
  name: string;
  category: string;
  isProject?: boolean;
  projectOffers?: string | null;
  projectOfferPackages?: ProjectOfferPackage[];
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
  const [projectOffersExpanded, setProjectOffersExpanded] = useState(false);
  const [projectPhotoIndex, setProjectPhotoIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  /* El diálogo vive aquí y no dentro de `ActionButtons` porque hay dos rejillas
     —la de escritorio y la de móvil— montadas a la vez: dentro habría dos
     diálogos, y dos estados de nota distintos para la misma opinión. */
  const [reviewOpen, setReviewOpen] = useState(false);
  /* Cuenta las reseñas publicadas. La lista la lee y la usa como señal para
     releer: sin esto, quien acaba de opinar cerraría el diálogo y seguiría sin
     ver la suya. */
  const [reviewsKey, setReviewsKey] = useState(0);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then(
        (data: { authenticated: boolean; user: { id?: string } | null }) => {
          if (data.authenticated && data.user?.id) setUserId(data.user.id);
        },
      )
      .catch(() => {});
  }, []);

  /* Abrir la ficha es la visita. Se cuenta aquí y no en cada página porque por
     este componente pasan todas: la ficha de `/place/[id]` y la que abre el
     panel del home. El store ignora la repetición dentro de una ventana corta,
     que es lo que evita que el doble montaje —panel y hoja— cuente doble. */
  /* El pageview del lugar se emite una sola vez por ficha, y no en cada
     re-ejecución de este efecto —el id de usuario llega de /api/me y pasa de
     null a su valor, lo que dispararía el efecto dos veces—. El guard por ref
     evita el doble conteo. */
  const viewTracked = useRef<string | null>(null);
  useEffect(() => {
    recordVisit(
      { id: place.id, name: place.name, category: place.category },
      userId,
    );
    if (viewTracked.current !== place.id) {
      viewTracked.current = place.id;
      trackPlaceMetric(place.id, "view");
      trackPlaceViewed({
        id: place.id,
        name: place.name,
        category: place.category,
        barrio: place.barrio,
      });
    }
  }, [place.id, place.name, place.category, place.barrio, userId]);

  /* El estado de guardado se lee en efecto y no en el inicializador: en el
     servidor no hay `localStorage`, así que arrancar de ahí daría un HTML
     distinto al del cliente y React se quejaría al hidratar. */
  useEffect(() => {
    setSaved(isPlaceSaved(place.id, userId));
  }, [place.id, userId]);

  const isClosed = !place.isProject &&
    (state === "closed" || (!place.isOpen && state !== "special-offer"));
  const hasPhotos = state !== "no-photos" && place.slides.length > 0;
  const showOffer = !place.isProject && state === "special-offer" && place.specialOffer;
  const projectPhotos = place.slides.filter((slide) => Boolean(slide.url));
  const activeProjectPhoto = projectPhotoIndex === null ? null : projectPhotos[projectPhotoIndex] ?? null;

  /* `distance` es un cajón de sastre: trae la distancia, la dirección o el
     barrio, lo que haya. El barrio se pinta por su cuenta, así que aquí solo
     queda lo que no sea ya el barrio. Sin esta guarda la línea decía
     "Centro Habana · Centro Habana", y en móvil además repetía la celda del
     `InfoBar`. */
  const location = place.distance === place.barrio ? "" : place.distance;

  function handleSave() {
    const next = toggleSaved(place.id, userId);
    setSaved(next);
    trackPlaceMetric(place.id, "save");
    trackPlaceSaveToggled(place.id, place.name, next);
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
      <div className="hidden lg:block lg:h-[calc(100dvh_-_var(--header-h))] lg:overflow-hidden lg:max-w-container lg:mx-auto lg:px-gutter-lg lg:py-gap-xl">
        {place.isProject ? (
          <div className="grid h-full min-h-0 grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)] grid-rows-[minmax(0,1fr)] items-stretch gap-gap-xl">
            <div className="flex h-full min-h-0 flex-col gap-gap-md overflow-y-auto overscroll-contain pr-gap-xs scrollbar-hide">
              <Reveal>
                <header className="flex flex-col gap-gap-sm">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-verde-200 bg-verde-50 px-3 py-1 font-lv-display text-xs font-semibold uppercase tracking-[0.06em] text-verde-700">
                    <Megaphone size={13} /> Proyecto
                  </span>
                  <h1 className="font-lv-display text-h1 font-bold leading-tight text-ink text-balance">{place.name}</h1>
                  <div className="flex flex-wrap gap-gap-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-small font-medium text-ink-soft/80">
                      <CalendarDays size={15} className="text-verde-600" /> {place.schedule}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-small font-medium text-ink-soft/80">
                      <MapPin size={15} className="text-verde-600" /> {place.barrio}
                    </span>
                  </div>
                  <ActionButtons
                    isSaved={saved}
                    onSave={handleSave}
                    onNavigate={onNavigate}
                    onShare={onShare}
                  />
                </header>
              </Reveal>

              <Reveal>
                <section className={CARD}>
                  <h2 className={cn(H2, "mb-gap-sm")}>Sobre el proyecto</h2>
                  <p className={cn("whitespace-pre-wrap text-body leading-relaxed text-ink", !descExpanded && "line-clamp-4")}>
                    {place.longDescription}
                  </p>
                  {place.longDescription.length > 220 && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((expanded) => !expanded)}
                      aria-expanded={descExpanded}
                      className={cn(BTN_OUTLINE, "mt-gap-md")}
                    >
                      {descExpanded ? "Leer menos" : "Leer más"}
                      <ChevronDown size={16} className={cn(CHEVRON, descExpanded && "rotate-180")} />
                    </button>
                  )}
                </section>
              </Reveal>

              <Reveal>
                <section className={CARD}>
                  <h2 className={cn(H2, "mb-gap-sm")}>Qué ofrece el proyecto</h2>
                  {place.projectOfferPackages?.length ? (
                    <ProjectOfferList offers={place.projectOfferPackages} />
                  ) : place.projectOffers ? (
                    <>
                      <p className={cn("whitespace-pre-wrap text-body leading-relaxed text-ink", !projectOffersExpanded && "line-clamp-4")}>
                        {place.projectOffers}
                      </p>
                      {place.projectOffers.length > 220 && (
                        <button
                          type="button"
                          onClick={() => setProjectOffersExpanded((expanded) => !expanded)}
                          aria-expanded={projectOffersExpanded}
                          className={cn(BTN_OUTLINE, "mt-gap-md")}
                        >
                          {projectOffersExpanded ? "Ver menos" : "Ver todo"}
                          <ChevronDown size={16} className={cn(CHEVRON, projectOffersExpanded && "rotate-180")} />
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-small leading-relaxed text-ink-soft/75">Este proyecto aún no ha añadido información sobre lo que ofrece.</p>
                  )}
                </section>
              </Reveal>
            </div>

            <Reveal className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain pr-gap-xs scrollbar-hide">
              <section aria-label={`Fotos y afiches de ${place.name}`} className="grid grid-cols-2 gap-gap-sm">
                {projectPhotos.map((slide, index) => (
                  <figure key={`${slide.url}-${index}`} className={cn("relative overflow-hidden rounded-2xl bg-sand-deep", index === 0 ? "col-span-2 aspect-[4/3]" : "aspect-square")}>
                    <button
                      type="button"
                      onClick={() => setProjectPhotoIndex(index)}
                      aria-label={`Ampliar foto ${index + 1} de ${place.name}`}
                      className="absolute inset-0 z-10 cursor-zoom-in focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-verde-400"
                    />
                    <Image
                      src={slide.url!}
                      alt={slide.alt || `${place.name}, imagen ${index + 1}`}
                      fill
                      sizes="(min-width: 1280px) 700px, 55vw"
                      className="object-cover"
                    />
                  </figure>
                ))}
                {projectPhotos.length === 0 && (
                  <div className="col-span-2 flex aspect-[4/3] flex-col items-center justify-center gap-gap-sm rounded-2xl border border-dashed border-ink/15 bg-white text-center text-ink-soft/70">
                    <ImageIcon size={32} strokeWidth={1.5} />
                    <p className="font-lv-display text-small font-medium">Fotos y afiches del proyecto</p>
                  </div>
                )}
              </section>
            </Reveal>
          </div>
        ) : (
          <>
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
                {place.isProject ? <Megaphone size={12} /> : (
                  <span
                    className={cn(
                      "size-[6px] rounded-full",
                      isClosed ? "bg-white/80" : "bg-verde-950/60",
                    )}
                  />
                )}
                {place.isProject ? "Proyecto" : isClosed ? "Cerrado" : "Abierto"}
              </span>
              {place.rating > 0 && (
                <span className="inline-flex items-center gap-[4px] font-lv-display text-xs font-semibold text-white/80">
                  <Star
                    size={12}
                    strokeWidth={1.8}
                    className="text-verde-300"
                    fill="currentColor"
                  />
                  {place.rating}
                </span>
              )}
            </div>
          </div>
        </Reveal>

        {/* Row 2: Info Strip (compact) */}
        <Reveal
          delay={0.05}
          className="flex items-center gap-gap-lg mb-gap-lg px-gap-md"
        >
          <div className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
            {place.isProject ? <CalendarDays size={14} strokeWidth={1.8} className="text-verde-600" /> : <Clock size={14} strokeWidth={1.8} className="text-verde-600" />}
            <span className="font-lv-display font-medium text-ink">
              {place.schedule}
            </span>
          </div>
          <span className="text-ink/10">|</span>
          <div className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
            <MapPin size={14} strokeWidth={1.8} className="text-verde-600" />
            <span className="font-lv-display font-medium text-ink">
              {location ? `${location} · ${place.barrio}` : place.barrio}
            </span>
          </div>
          {!place.isProject && (
            <>
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
            </>
          )}
          <span className="text-ink/10">|</span>
          <div className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
            {place.isProject ? <Megaphone size={14} strokeWidth={1.8} className="text-verde-600" /> : <Utensils size={14} strokeWidth={1.8} className="text-verde-600" />}
            <span className="font-lv-display font-medium text-ink">
              {place.category}
            </span>
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
              onReview={place.isProject ? undefined : () => setReviewOpen(true)}
            />

            {!place.isProject && <WhyCard place={place} />}

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
                <h2 className={cn(H2, "mb-gap-sm")}>{place.isProject ? "Sobre el proyecto" : "Sobre este lugar"}</h2>
                <p
                  className={cn(
                    "text-body leading-relaxed text-ink whitespace-pre-wrap",
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

            {/* A project describes its offer as text, not as a business menu. */}
            <Reveal>
              {place.isProject ? (
                <section className={CARD}>
                  <h2 className={cn(H2, "mb-gap-md")}>Qué ofrece el proyecto</h2>
                  {place.projectOfferPackages?.length ? (
                    <ProjectOfferList offers={place.projectOfferPackages} />
                  ) : place.projectOffers ? (
                    <>
                      <p className={cn("whitespace-pre-wrap text-body leading-relaxed text-ink", !projectOffersExpanded && "line-clamp-3")}>
                        {place.projectOffers}
                      </p>
                      {place.projectOffers.length > 180 && (
                        <button
                          type="button"
                          onClick={() => setProjectOffersExpanded((expanded) => !expanded)}
                          aria-expanded={projectOffersExpanded}
                          className={cn(BTN_OUTLINE, "mt-gap-md")}
                        >
                          {projectOffersExpanded ? "Ver menos" : "Ver todo"}
                          <ChevronDown size={16} strokeWidth={1.8} className={cn(CHEVRON, projectOffersExpanded && "rotate-180")} />
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-small leading-relaxed text-ink-soft/75">Este proyecto aún no ha añadido información sobre lo que ofrece.</p>
                  )}
                </section>
              ) : (
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
              )}
            </Reveal>

            {/* Reviews */}
            {!place.isProject && (
              <Reveal>
                <section className={CARD}>
                  <ReviewsSection placeId={place.id} reloadKey={reviewsKey} />
                </section>
              </Reveal>
            )}

            {footerSlot}
          </div>
        </div>
          </>
        )}
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
                  {place.isProject ? <Megaphone size={12} /> : (
                    <span
                      className={cn(
                        "size-[6px] rounded-full",
                        isClosed ? "bg-destructive" : "bg-verde-400",
                      )}
                    />
                  )}
                  {place.isProject ? "Proyecto" : isClosed ? "Cerrado" : "Abierto"}
                </span>
              </div>
              <div className="flex items-center gap-gap-sm flex-wrap">
                <span className="inline-flex items-center gap-[4px] px-[10px] py-[3px] rounded-full bg-verde-50 border border-verde-200 text-verde-600 font-lv-display text-xs font-semibold uppercase tracking-[0.06em]">
                  {place.isProject ? <Megaphone size={12} strokeWidth={1.8} /> : <Utensils size={12} strokeWidth={1.8} />}
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
                    <MapPin
                      size={14}
                      strokeWidth={1.8}
                      className="text-verde-600"
                    />
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
                  <Clock
                    size={18}
                    strokeWidth={1.8}
                    className="text-destructive"
                  />
                </div>
                {/* El chip de arriba ya dice "Cerrado". Repetirlo aquí dejaba
                    la línea en "Cerrado ahora · Cerrado temporalmente." */}
                <div className="text-small text-ink leading-snug">
                  {place.closedMessage}
                </div>
              </div>
            </Reveal>
          )}

          {/* Info Bar */}
          <Reveal delay={0.05}>
            <InfoBar
              schedule={place.schedule}
              barrio={place.barrio}
              payments={place.payments}
              isProject={place.isProject}
            />
          </Reveal>

          {/* Action Buttons */}
          <Reveal delay={0.05}>
            <ActionButtons
              isSaved={saved}
              onSave={handleSave}
              onNavigate={onNavigate}
              onShare={onShare}
              onReview={place.isProject ? undefined : () => setReviewOpen(true)}
            />
          </Reveal>

          {/* Divider */}
          <div className="h-[8px] bg-sand-deep" />

          {/* AI Recommendation */}
          <Reveal>
            {!place.isProject && <WhyCard place={place} className="mx-gutter my-gap-md" />}
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
              <h2 className={cn(H2, "mb-gap-sm")}>{place.isProject ? "Sobre el proyecto" : "Sobre este lugar"}</h2>
              <p
                className={cn(
                  "text-body leading-relaxed text-ink whitespace-pre-wrap",
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
          {!place.isProject && (
            <Reveal>
              <section className="p-gap-lg px-gutter bg-sand-warm">
                <ReviewsSection placeId={place.id} reloadKey={reviewsKey} />
              </section>
            </Reveal>
          )}

          {/* Project offer details are not business menu items. */}
          <div className="h-[8px] bg-sand-deep" />
          <Reveal>
            <section className="p-gap-lg px-gutter bg-sand-warm">
              {place.isProject ? (
                <>
                  <h2 className={cn(H2, "mb-gap-md")}>Qué ofrece el proyecto</h2>
                  {place.projectOfferPackages?.length ? (
                    <ProjectOfferList offers={place.projectOfferPackages} />
                  ) : place.projectOffers ? (
                    <>
                      <p className={cn("whitespace-pre-wrap text-body leading-relaxed text-ink", !projectOffersExpanded && "line-clamp-3")}>
                        {place.projectOffers}
                      </p>
                      {place.projectOffers.length > 180 && (
                        <button
                          type="button"
                          onClick={() => setProjectOffersExpanded((expanded) => !expanded)}
                          aria-expanded={projectOffersExpanded}
                          className={cn(BTN_OUTLINE, "mt-gap-md")}
                        >
                          {projectOffersExpanded ? "Ver menos" : "Ver todo"}
                          <ChevronDown size={16} strokeWidth={1.8} className={cn(CHEVRON, projectOffersExpanded && "rotate-180")} />
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-small leading-relaxed text-ink-soft/75">Este proyecto aún no ha añadido información sobre lo que ofrece.</p>
                  )}
                </>
              ) : (
                <>
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
                </>
              )}
            </section>
          </Reveal>

          {footerSlot}
        </div>
      </div>

      {/* Bottom safe area */}
      <div className="pb-safe-bottom bg-sand" />

      {/* Va al final y fuera de los dos bloques de maquetación: es uno solo para
          la ficha entera, se abra desde donde se abra. */}
      {!place.isProject && (
        <ReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          placeId={place.id}
          placeName={place.name}
          onPublished={() => setReviewsKey((k) => k + 1)}
        />
      )}
      {place.isProject && (
        <Dialog open={activeProjectPhoto !== null} onOpenChange={(open) => { if (!open) setProjectPhotoIndex(null); }}>
          <DialogContent className="w-[calc(100vw_-_32px)] max-w-6xl border-0 bg-ink p-0 shadow-none sm:w-[calc(100vw_-_64px)] [&>button]:text-white [&>button:hover]:bg-white/15 [&>button:hover]:text-white">
            <DialogTitle className="sr-only">Fotos de {place.name}</DialogTitle>
            {activeProjectPhoto && (
              <div className="relative h-[82dvh] min-h-[240px] max-h-[900px] w-full">
                <Image
                  src={activeProjectPhoto.url!}
                  alt={activeProjectPhoto.alt || `Foto de ${place.name}`}
                  fill
                  sizes="95vw"
                  quality={95}
                  className="object-contain"
                />
                {projectPhotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setProjectPhotoIndex((index) => index === null ? null : (index - 1 + projectPhotos.length) % projectPhotos.length)}
                      aria-label="Foto anterior"
                      className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-ink/70 text-white hover:bg-ink/90"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectPhotoIndex((index) => index === null ? null : (index + 1) % projectPhotos.length)}
                      aria-label="Foto siguiente"
                      className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-ink/70 text-white hover:bg-ink/90"
                    >
                      <ChevronRight size={22} />
                    </button>
                  </>
                )}
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/75 px-3 py-1 text-meta font-semibold text-white">
                  {projectPhotoIndex! + 1} / {projectPhotos.length}
                </span>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ProjectOfferList({ offers }: { offers: ProjectOfferPackage[] }) {
  return (
    <ul className="divide-y divide-ink/10">
      {offers.map((offer, index) => (
        <li key={offer.id} className="py-gap-sm first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-gap-sm gap-y-1">
            <h3 className="font-lv-display text-small font-semibold text-ink">{offer.title || `Oferta ${index + 1}`}</h3>
            {offer.price && <span className="font-lv-display text-small font-semibold text-verde-700">{offer.price}</span>}
          </div>
          {(offer.capacity || offer.validUntil) && (
            <p className="mt-1 text-meta text-ink-soft/70">
              {[offer.capacity ? `${offer.capacity} personas` : "", offer.validUntil ? `Vigente hasta ${offer.validUntil}` : ""].filter(Boolean).join(" · ")}
            </p>
          )}
          {offer.includes.length > 0 && (
            <ul className="mt-gap-xs flex flex-col gap-1 text-small leading-relaxed text-ink-soft/85">
              {offer.includes.map((item, itemIndex) => <li key={`${offer.id}-${itemIndex}`}>{item}</li>)}
            </ul>
          )}
          {offer.conditions && <p className="mt-gap-xs whitespace-pre-wrap text-small leading-relaxed text-ink-soft/75">{offer.conditions}</p>}
        </li>
      ))}
    </ul>
  );
}

/**
 * Por qué La Verde lo recomienda. Sale en el escritorio (columna lateral) y en
 * móvil (a lo ancho); el marcado es el mismo y solo cambian los márgenes, que
 * entran por `className`.
 *
 * Tiene dos formas, según cómo se llegó al lugar.
 *
 * Si se llegó por el buscador de lenguaje natural, la tarjeta cita lo que el
 * usuario escribió y **la razón que la IA dio para este lugar en concreto**.
 * Ese texto ya existía: el servidor lo devuelve como `matches[].reason` y hasta
 * ahora solo ordenaba la lista antes de perderse. Ver
 * `src/lib/ai-recommendation-store.ts` para dónde vive y por qué ahí.
 *
 * Si se llegó a mano —un pin del mapa, una URL compartida— no hay consulta que
 * citar, y la tarjeta se queda con lo que la ficha sabe de verdad del negocio:
 * categoría, barrio, precio y las etiquetas. Antes decía «Buscaste "buscar
 * restaurante en Cuba"» —una consulta fabricada que nadie escribió— y una razón
 * que venía de un campo sin columna en la base, así que salía siempre el mismo
 * relleno: «listo para ser recomendado». Ahora la consulta que se cita es una
 * que alguien escribió, porque solo se cita cuando la hay.
 *
 * Lo que se dice aquí es lo que no se ve en ninguna otra parte de la ficha: el
 * horario está en el `InfoBar`, la nota en la cabecera y la dirección en su
 * línea. Repetirlos sería volver a lo de antes.
 */
function WhyCard({
  place,
  className,
}: {
  place: PlaceData;
  className?: string;
}) {
  /* En efecto y no en el inicializador: en el servidor no hay `localStorage`, y
     arrancar de ahí daría un HTML distinto al del cliente. Misma razón que el
     `setSaved` de `PlaceDetail`. */
  const [recommendation, setRecommendation] = useState<AiRecommendation | null>(
    null,
  );
  useEffect(() => {
    setRecommendation(readAiRecommendation(place.id));
  }, [place.id]);

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
          <div className="text-meta text-ink-soft/75">
            {recommendation ? "Según tu búsqueda" : "Datos del lugar"}
          </div>
        </div>
      </div>

      {recommendation ? (
        /* La consulta y la razón van como texto de React, nunca como HTML: la
           frase la escribe un modelo a partir de lo que tecleó el usuario. */
        <div className="text-small leading-relaxed text-ink text-pretty">
          <span className="text-ink-soft/75">
            Buscaste «{recommendation.query}».{" "}
          </span>
          {recommendation.reason}
        </div>
      ) : (
        <div className="text-small leading-relaxed text-ink text-pretty">
          {lines.join(". ")}.
        </div>
      )}

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
