"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import {
  ArrowLeft,
  CalendarDays,
  Megaphone,
  Utensils,
  Clock,
  Star,
  MapPin,
  CreditCard,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Facebook,
  Globe,
  Image as ImageIcon,
  Instagram,
  MessageCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn, currencyLabel, currencyStyles } from "@/lib/utils";
import type { ContactLinks } from "@/lib/contact-links";
import {
  isSaved as isPlaceSaved,
  recordVisit,
  toggleSaved,
} from "@/lib/activity-store";
import { trackPlaceSaveToggled, trackPlaceViewed } from "@/lib/analytics";
import { trackClientEvent } from "@/lib/analytics/client";
import type { AnalyticsEventType } from "@/lib/analytics/events";
import { trackPlaceMetric } from "@/lib/place-metrics";
import { PhotoCarousel, type Slide } from "./photo-carousel";
import { InfoBar } from "./info-bar";
import { PaymentsSection } from "./payments-section";
import { ActionButtons } from "./action-buttons";
import { MenuPages } from "./menu-pages";
import { OfferBanner } from "./offer-banner";
import { ReviewDialog } from "./review-dialog";
import { ReviewsSection } from "./reviews-section";
import { Reveal } from "@/components/ui/reveal";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ProjectOfferPackage } from "@/lib/db/schema/project_requests";
import { placeIcon } from "@/lib/places";
import { resolveCategoryIcon } from "@/lib/category-icons";

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
  /** Círculo de marca: el logo del negocio, y si no lo hay, la portada. */
  logoUrl?: string;
  barrio: string;
  schedule: string;
  address?: string;
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
  icon?: string;
  isBoosted?: boolean;
  slides: Slide[];
  menu: PlaceMenu[];
  /**
   * Los enlaces de la sección «Contacto», ya convertidos en href por
   * `contactLinks` (la ficha no normaliza nada). Sin ninguno relleno la tarjeta
   * no se pinta, así que un negocio de los que no lo rellenaron no gana un
   * bloque vacío en su ficha.
   */
  contact: ContactLinks;
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

const CARD = "bg-white rounded-2xl border border-ink/5 shadow-soft p-gap-xl";
const H2 = "font-lv-display text-h3 font-bold text-ink";

/* Cuándo el párrafo clampsado merece botón. El `line-clamp` no se puede medir
   desde CSS, así que se estima por caracteres: por debajo de esto el texto cabe
   en las dos o tres líneas del recorte y el botón no tendría nada que
   desplegar. Se elige el umbral de los dos que había —220 y 180— y no el mayor,
   porque el error caro es el otro: un párrafo recortado sin botón deja texto
   que nadie puede leer, mientras que un botón de más solo se ve de más. */
const CLAMP_MIN_CHARS = 180;

/* El recorte de «Sobre este lugar»: dos líneas visibles y el resto al abrir.
   Va en `style` y no en clases a propósito — ver el porqué en la sección—, así
   que las tres constantes viven juntas y en un solo sitio. El alto recogido son
   dos renglones de `leading-relaxed`, en `em` para medirlo contra el `font-size`
   del propio párrafo y no contra la raíz. */
const DESC_LINE_HEIGHT = 1.625;
const DESC_COLLAPSED = `${DESC_LINE_HEIGHT * 2}em`;
/* Tope de sobra para cualquier descripción real: sin un número no hay
   transición, y `max-height: none` no se anima. */
const DESC_EXPANDED = "40em";

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
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [projectPhotoIndex, setProjectPhotoIndex] = useState<number | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // Icon for category badge
  const iconName = placeIcon(place.icon ?? undefined, place.category);
  const Icon = resolveCategoryIcon(iconName);
  /* La marca del negocio: el logo si lo subió, y si no la portada. Vale para el
     círculo de móvil y para el de la banda de escritorio. */
  const brandUrl = place.logoUrl || place.slides[0]?.url || null;

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
    if (viewTracked.current !== place.id) {
      viewTracked.current = place.id;
      recordVisit(
        { id: place.id, name: place.name, category: place.category },
        userId,
      );
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

  /* Alto de dos líneas de la descripción, medido. Para animar el despliegue
     hace falta un número: no se puede animar contra un `line-clamp`, y el
     `line-height` sale del tema, así que no se escribe a mano. El `h-[2lh]`
     del elemento cubre el fotograma de antes de que esto mida. */
  const isClosed =
    !place.isProject &&
    (state === "closed" || (!place.isOpen && state !== "special-offer"));
  const hasPhotos = state !== "no-photos" && place.slides.length > 0;
  const showOffer =
    !place.isProject && state === "special-offer" && place.specialOffer;
  const projectPhotos = place.slides.filter((slide) => Boolean(slide.url));
  const activeProjectPhoto =
    projectPhotoIndex === null
      ? null
      : (projectPhotos[projectPhotoIndex] ?? null);

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
      {/* La carcasa de alto fijo y `overflow-hidden` es solo del proyecto: sus
          dos columnas traen su propio scroll interno (`overflow-y-auto`) y
          necesitan una altura que las limite. La ficha normal no tiene ningún
          contenedor que scrolle dentro, así que con la carcasa puesta el
          contenido de debajo —contacto, descripción, menú, reseñas— se recortaba
          contra el borde y no había forma de bajarlo: el bloque medía justo el
          viewport y la página no scrolleaba. */}
      <div
        className={cn(
          "hidden lg:block lg:max-w-container lg:mx-auto lg:px-gutter-lg lg:py-gap-xl",
          place.isProject &&
            "lg:h-[calc(100dvh_-_var(--header-h))] lg:overflow-hidden",
        )}
      >
        {place.isProject ? (
          <div className="grid h-full min-h-0 grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)] grid-rows-[minmax(0,1fr)] items-stretch gap-gap-xl">
            <div className="flex h-full min-h-0 flex-col gap-gap-md overflow-y-auto overscroll-contain pr-gap-xs scrollbar-hide">
              <Reveal>
                <header className="flex flex-col gap-gap-sm">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-verde-200 bg-verde-50 px-3 py-1 font-lv-display text-xs font-semibold uppercase tracking-[0.06em] text-verde-700">
                    <Megaphone size={13} /> Proyecto
                  </span>
                  <h1 className="font-lv-display text-h1 font-bold leading-tight text-ink text-balance">
                    {place.name}
                  </h1>
                  <div className="flex flex-wrap gap-gap-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-small font-medium text-ink-soft/80">
                      <CalendarDays size={15} className="text-verde-600" />{" "}
                      {place.schedule}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-small font-medium text-ink-soft/80">
                      <MapPin size={15} className="text-verde-600" />{" "}
                      {place.barrio}
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
                  <p
                    className={cn(
                      "whitespace-pre-wrap text-body leading-relaxed text-ink",
                      !descExpanded && "line-clamp-4",
                    )}
                  >
                    {place.longDescription}
                  </p>
                  {place.longDescription.length > CLAMP_MIN_CHARS && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded((expanded) => !expanded)}
                      aria-expanded={descExpanded}
                      className={cn(BTN_OUTLINE, "mt-gap-md")}
                    >
                      {descExpanded ? "Leer menos" : "Leer más"}
                      <ChevronDown
                        size={16}
                        className={cn(CHEVRON, descExpanded && "rotate-180")}
                      />
                    </button>
                  )}
                </section>
              </Reveal>

              <Reveal>
                <section className={CARD}>
                  <h2 className={cn(H2, "mb-gap-sm")}>
                    Qué ofrece el proyecto
                  </h2>
                  {place.projectOfferPackages?.length ? (
                    <ProjectOfferList offers={place.projectOfferPackages} />
                  ) : place.projectOffers ? (
                    <>
                      <p
                        className={cn(
                          "whitespace-pre-wrap text-body leading-relaxed text-ink",
                          !projectOffersExpanded && "line-clamp-4",
                        )}
                      >
                        {place.projectOffers}
                      </p>
                      {place.projectOffers.length > CLAMP_MIN_CHARS && (
                        <button
                          type="button"
                          onClick={() =>
                            setProjectOffersExpanded((expanded) => !expanded)
                          }
                          aria-expanded={projectOffersExpanded}
                          className={cn(BTN_OUTLINE, "mt-gap-md")}
                        >
                          {projectOffersExpanded ? "Ver menos" : "Ver todo"}
                          <ChevronDown
                            size={16}
                            className={cn(
                              CHEVRON,
                              projectOffersExpanded && "rotate-180",
                            )}
                          />
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-small leading-relaxed text-ink-soft/75">
                      Este proyecto aún no ha añadido información sobre lo que
                      ofrece.
                    </p>
                  )}
                </section>
              </Reveal>
            </div>

            <Reveal className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain pr-gap-xs scrollbar-hide">
              <section
                aria-label={`Fotos y afiches de ${place.name}`}
                className="grid grid-cols-2 gap-gap-sm"
              >
                {projectPhotos.map((slide, index) => (
                  <figure
                    key={`${slide.url}-${index}`}
                    className={cn(
                      "relative overflow-hidden rounded-2xl bg-sand-deep",
                      index === 0 ? "col-span-2 aspect-[4/3]" : "aspect-square",
                    )}
                  >
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
                    <p className="font-lv-display text-small font-medium">
                      Fotos y afiches del proyecto
                    </p>
                  </div>
                )}
              </section>
            </Reveal>
          </div>
        ) : (
          <>
            {/* Row 1: Photo Carousel (full width) with place name overlay.

                La máscara es del envoltorio entero, no de la foto: la banda
                oscura que sostiene el nombre es hermana del carrusel, y si solo
                se difuminara la imagen el canto recto seguiría ahí, ahora en
                negro. Con la máscara en el padre se disuelven los dos, y con
                ellos la esquina redondeada —que a partir de ahora no la dibuja
                nadie, la hace el desvanecido—. */}
            <Reveal className="relative mb-gap-lg [mask-image:linear-gradient(to_bottom,black_87%,transparent)]">
              <PhotoCarousel
                slides={place.slides}
                hasPhotos={hasPhotos}
                className="aspect-[16/9] rounded-4xl overflow-hidden"
              />
              {/* `pb` en porcentaje y no en píxeles a propósito: el porcentaje
                  de un padding vertical se calcula sobre el ancho, que aquí
                  guarda proporción fija con el alto (16/9), así que el nombre
                  se queda siempre al mismo 77% de la altura y el pie de la
                  foto siempre le pasa por debajo vacío. */}
              <div className="absolute bottom-0 left-0 right-0 px-gap-xl pt-gap-xl pb-[13%] bg-gradient-to-t from-ink/85 via-ink/40 to-transparent rounded-b-4xl pointer-events-none">
                {/* La marca solo cuando la hay: sin logo ni fotos, un círculo
                    con el icono de la categoría sobre la foto oscura sería un
                    adorno que no dice nada que no diga la categoría de abajo. */}
                <div className="flex items-center gap-gap-md">
                  {brandUrl && (
                    <span className="relative block size-16 shrink-0 overflow-hidden rounded-full border border-white/25 bg-white">
                      <Image
                        src={brandUrl}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </span>
                  )}
                  <div className="min-w-0">
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
                        {place.isProject ? (
                          <Megaphone size={12} />
                        ) : (
                          <span
                            className={cn(
                              "size-[6px] rounded-full",
                              isClosed ? "bg-white/80" : "bg-verde-950/60",
                            )}
                          />
                        )}
                        {place.isProject
                          ? "Proyecto"
                          : isClosed
                            ? "Cerrado"
                            : "Abierto"}
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
                </div>
              </div>
            </Reveal>

            {/* Row 2: Info Strip (compact) */}
            <Reveal
              delay={0.05}
              className="flex items-center gap-gap-lg mb-gap-lg px-gap-md"
            >
              <div className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
                {place.isProject ? (
                  <Megaphone
                    size={14}
                    strokeWidth={1.8}
                    className="text-verde-600"
                  />
                ) : (
                  <Utensils
                    size={14}
                    strokeWidth={1.8}
                    className="text-verde-600"
                  />
                )}
                <span className="font-lv-display font-medium text-ink">
                  {place.category}
                </span>
              </div>
              <span className="text-ink/10">|</span>
              <div className="flex items-center gap-gap-xs text-meta text-ink-soft/75">
                <MapPin
                  size={14}
                  strokeWidth={1.8}
                  className="text-verde-600"
                />
                <span className="font-lv-display font-medium text-ink">
                  {place.address
                    ? `${place.address}, ${place.barrio}`
                    : place.barrio}
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
                  onReview={
                    place.isProject ? undefined : () => setReviewOpen(true)
                  }
                />

                {/* Sin condición: `ContactCard` ya devuelve `null` cuando no hay
                ningún enlace, y un proyecto no llega con `whatsapp` ni redes
                mapeados, así que ahí simplemente no se pinta. */}
                <ContactCard place={place} />

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
                    <h2 className={cn(H2, "mb-gap-sm")}>
                      {place.isProject
                        ? "Sobre el proyecto"
                        : "Sobre este lugar"}
                    </h2>
                    <p
                      className="overflow-hidden text-body leading-relaxed text-ink whitespace-pre-wrap transition-[max-height] duration-500 ease-outquint"
                      style={{
                        maxHeight: descExpanded
                          ? DESC_EXPANDED
                          : DESC_COLLAPSED,
                        lineHeight: DESC_LINE_HEIGHT,
                      }}
                    >
                      {place.longDescription}
                    </p>
                    {place.longDescription.length > CLAMP_MIN_CHARS && (
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
                    )}
                  </section>
                </Reveal>

                {/* A project describes its offer as text, not as a business menu. */}
                <Reveal>
                  {place.isProject ? (
                    <section className={CARD}>
                      <h2 className={cn(H2, "mb-gap-md")}>
                        Qué ofrece el proyecto
                      </h2>
                      {place.projectOfferPackages?.length ? (
                        <ProjectOfferList offers={place.projectOfferPackages} />
                      ) : place.projectOffers ? (
                        <>
                          <p
                            className={cn(
                              "whitespace-pre-wrap text-body leading-relaxed text-ink",
                              !projectOffersExpanded && "line-clamp-3",
                            )}
                          >
                            {place.projectOffers}
                          </p>
                          {place.projectOffers.length > CLAMP_MIN_CHARS && (
                            <button
                              type="button"
                              onClick={() =>
                                setProjectOffersExpanded(
                                  (expanded) => !expanded,
                                )
                              }
                              aria-expanded={projectOffersExpanded}
                              className={cn(BTN_OUTLINE, "mt-gap-md")}
                            >
                              {projectOffersExpanded ? "Ver menos" : "Ver todo"}
                              <ChevronDown
                                size={16}
                                strokeWidth={1.8}
                                className={cn(
                                  CHEVRON,
                                  projectOffersExpanded && "rotate-180",
                                )}
                              />
                            </button>
                          )}
                        </>
                      ) : (
                        <p className="text-small leading-relaxed text-ink-soft/75">
                          Este proyecto aún no ha añadido información sobre lo
                          que ofrece.
                        </p>
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
                          id="menu-see-all-trigger-desktop"
                          onClick={onMenuSeeAll}
                          aria-expanded="false"
                          aria-controls="full-menu-list-desktop"
                          className={cn(BTN_OUTLINE, "group")}
                        >
                          Ver todo
                          <ChevronRight
                            size={16}
                            strokeWidth={1.8}
                            className={cn(
                              CHEVRON,
                              "group-hover:translate-x-[2px]",
                            )}
                          />
                        </button>
                      </div>
                      <div id="full-menu-list-desktop">
                        <MenuPages items={place.menu} variant="grid" />
                      </div>
                    </section>
                  )}
                </Reveal>

                {/* Reviews */}
                {!place.isProject && (
                  <Reveal>
                    <section className={CARD}>
                      <ReviewsSection
                        placeId={place.id}
                        reloadKey={reviewsKey}
                      />
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
          {/* Photo Carousel. El mismo desvanecido que en escritorio, aquí sobre
              el carrusel solo: en móvil no hay banda oscura ni nombre encima,
              así que no hay nada más que disolver. */}
          <Reveal>
            <PhotoCarousel
              slides={place.slides}
              hasPhotos={hasPhotos}
              className="[mask-image:linear-gradient(to_bottom,black_87%,transparent)]"
            />
          </Reveal>

          {/* Place Info. Sin borde: la foto de arriba se disuelve en el fondo y
              el canto de este bloque caía justo debajo del desvanecido, así que
              la raya lo cortaba en seco. `sand-warm` y `sand` son casi el mismo
              tono, así que quitando el borde el paso no se ve. */}
          <Reveal delay={0.05}>
            <section className="p-gap-lg px-gutter bg-sand-warm">
              {/* Marca + nombre. El círculo enseña el logo del negocio, que es
                  lo que se sube en «Fotos del lugar» del formulario; si no lo
                  hay, cae a la portada —la primera foto, que es la que el dueño
                  ya sube— y al icono de la categoría cuando tampoco hay fotos. */}
              <div className="flex items-start gap-gap-md">
                <span className="relative block size-20 shrink-0 overflow-hidden rounded-full border border-ink/5 bg-white">
                  {brandUrl ? (
                    <Image
                      src={brandUrl}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center">
                      <Icon
                        size={28}
                        strokeWidth={1.8}
                        className="text-verde-600"
                      />
                    </span>
                  )}
                </span>
                {/* `flex-1 min-w-0` para que una dirección larga rompa línea en
                    vez de empujar el nombre fuera de la pantalla. */}
                <div className="min-w-0 flex-1">
                  <h1 className="font-lv-display text-h3 font-bold leading-tight tracking-[-0.015em] text-ink text-balance">
                    {place.name}
                  </h1>
                  {/* Dos niveles y no una línea con un `·` en medio: la
                      dirección es la que puede ocupar dos renglones, así que va
                      arriba y con el icono alineado a su primera línea, no
                      centrado contra el bloque. El horario no se veía en
                      ninguna parte de la ficha en móvil: estaba solo en el
                      bloque de proyecto de escritorio. */}
                  <div className="mt-gap-xs flex flex-col gap-[2px] text-meta leading-relaxed text-ink-soft/75">
                    <span className="flex items-start gap-1.5">
                      <MapPin
                        size={13}
                        strokeWidth={1.8}
                        className="mt-[3px] shrink-0 text-verde-600"
                      />
                      <span>
                        {place.address
                          ? `${place.address}, ${place.barrio}`
                          : place.barrio}
                      </span>
                    </span>
                    {place.schedule ? (
                      <span className="flex items-start gap-1.5">
                        <Clock
                          size={13}
                          strokeWidth={1.8}
                          className="mt-[3px] shrink-0 text-verde-600"
                        />
                        <span>{place.schedule}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              {/* `flex-wrap` porque las cuatro acciones no siempre caben en la
                  misma línea que el chip de categoría: con una categoría larga
                  bajan a un segundo renglón y el `ml-auto` las deja igualmente
                  pegadas a la derecha. */}
              <div className="mt-gap-md flex flex-wrap items-center gap-x-gap-sm gap-y-gap-xs">
                <span className="inline-flex items-center gap-[4px] px-[10px] py-[3px] rounded-full bg-verde-50 border border-verde-200 text-verde-600 font-lv-display text-xs font-semibold uppercase tracking-[0.06em]">
                  {place.isProject ? (
                    <Megaphone size={12} strokeWidth={1.8} />
                  ) : (
                    <Icon size={12} strokeWidth={1.8} />
                  )}
                  {place.category}
                </span>
                {place.rating > 0 && (
                  <span className="inline-flex items-center gap-[4px] font-lv-display text-meta font-semibold text-verde-600">
                    <Star size={14} strokeWidth={1.8} fill="currentColor" />
                    {place.rating}
                  </span>
                )}
                <ActionButtons
                  compact
                  className="ml-auto"
                  isSaved={saved}
                  onSave={handleSave}
                  onNavigate={onNavigate}
                  onShare={onShare}
                  onReview={
                    place.isProject ? undefined : () => setReviewOpen(true)
                  }
                />
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

          {/* Aquí vivía la barra de «Categoría | Dirección». Se ha ido con el
              nombre nuevo: la categoría está en su chip justo arriba y la
              dirección bajo el nombre, así que las dos líneas se leían dos
              veces seguidas. */}

          {/* Descripción. Va justo debajo del nombre y por delante de pagos:
              es lo que más se lee de una ficha y estaba enterrada al final,
              tras la oferta. Sin `pt`: la cabecera de arriba ya baja con
              `p-gap-lg` y entre las dos sumaban 64 px de hueco. */}
          <Reveal>
            <section className="pb-gap-lg px-gutter bg-sand-warm">
              <h2 className={cn(H2, "mb-gap-sm")}>
                {place.isProject ? "Sobre el proyecto" : "Sobre este lugar"}
              </h2>
              {/* El texto **es** el botón. Antes el corte iba por número de
                  caracteres —más de 180— y eso dejaba textos de tres líneas
                  recortados a dos **sin botón**: se comían la última línea y no
                  había forma de leerla. El corte ahora es siempre y el que
                  sobra se abre tocando. El chevron de abajo es el aviso de que
                  hay más; va en un `span` y no en un `div` porque un botón solo
                  admite contenido en línea.

                  `max-height` y no `line-clamp`: así el despliegue se anima, que
                  con el corte de línea era un salto.

                  El alto va en `style` y no en una clase. En clase se quedaba
                  sin aplicar —el párrafo salía entero al entrar y el primer
                  toque no cambiaba nada, porque el estado ya estaba recogido y
                  lo único que faltaba era el tope—, y con el tope en línea no
                  hay generador de CSS ni orden de hojas que lo tumbe. Por lo
                  mismo el `lineHeight` va al lado del `maxHeight`: el valor está
                  en `em` y tiene que medirse contra el mismo renglón que se
                  pinta, no contra el que gane entre `text-body` y
                  `leading-relaxed`. Las tres constantes están arriba, juntas.

                  Antes esto lo hacía un `useEffect` que medía el `line-height`
                  real y lo aplicaba con `motion`. Dependía de que la medida
                  llegara y de que `animate`, que arrancaba sin valor, la
                  aceptara; hasta entonces se veía el texto completo. */}
              <button
                type="button"
                onClick={() => setDescExpanded((prev) => !prev)}
                aria-expanded={descExpanded}
                className="block w-full cursor-pointer text-left"
              >
                <span
                  className="block overflow-hidden text-body leading-relaxed text-ink whitespace-pre-wrap transition-[max-height] duration-500 ease-outquint"
                  style={{
                    maxHeight: descExpanded ? DESC_EXPANDED : DESC_COLLAPSED,
                    lineHeight: DESC_LINE_HEIGHT,
                  }}
                >
                  {place.longDescription}
                </span>
                <span className="mt-gap-xs flex justify-end">
                  <ChevronDown
                    size={16}
                    strokeWidth={1.8}
                    className={cn(
                      CHEVRON,
                      "text-verde-600",
                      descExpanded && "rotate-180",
                    )}
                  />
                </span>
              </button>
            </section>
          </Reveal>

          {/* Payments. Con el tono y el relleno de la cabecera y sin margen
              abajo: los dos bloques tienen que quedar pegados para leerse como
              una sola banda, que es lo que eran antes de que la tarjeta blanca
              de contacto los separara. */}
          <Reveal delay={0.05}>
            <PaymentsSection
              payments={place.payments}
              className="bg-sand-warm mb-0 px-gutter pb-gap-md"
            />
          </Reveal>

          {/* Los cuatro botones se han ido a la cabecera, con la nota. */}

          {/* Contacto. La tarjeta blanca se deshace en esta pantalla: sin
              fondo propio, sin esquinas y sin sombra, porque aquí no es una
              tarjeta sino la continuación de la banda de arriba. En escritorio
              sigue siendo la tarjeta blanca de la columna lateral, que ahí sí
              convive con otras del mismo tipo. */}
          <Reveal delay={0.05}>
            <ContactCard
              place={place}
              className="bg-sand-warm mx-0 my-0 rounded-none border-0 px-gutter pb-gap-lg shadow-none"
            />
          </Reveal>

          {/* Special Offer Banner. El `div` es solo el fondo: la tarjeta seguía
              sobre el `bg-sand` de la página y cortaba la banda. El relleno es
              de arriba porque el `mb-gap-md` de la tarjeta ya deja el de abajo. */}
          {showOffer && place.specialOffer && (
            <Reveal>
              <div className="bg-sand-warm pt-gap-md">
                <OfferBanner
                  label={place.specialOffer.label}
                  text={place.specialOffer.text}
                  expiry={place.specialOffer.expiry}
                  visible
                />
              </div>
            </Reveal>
          )}

          {/* Project offer details are not business menu items. */}
          <div className="h-gap-xs bg-sand-warm" />
          <Reveal>
            <section className="p-gap-lg px-gutter bg-sand-warm">
              {place.isProject ? (
                <>
                  <h2 className={cn(H2, "mb-gap-md")}>
                    Qué ofrece el proyecto
                  </h2>
                  {place.projectOfferPackages?.length ? (
                    <ProjectOfferList offers={place.projectOfferPackages} />
                  ) : place.projectOffers ? (
                    <>
                      <p
                        className={cn(
                          "whitespace-pre-wrap text-body leading-relaxed text-ink",
                          !projectOffersExpanded && "line-clamp-3",
                        )}
                      >
                        {place.projectOffers}
                      </p>
                      {place.projectOffers.length > CLAMP_MIN_CHARS && (
                        <button
                          type="button"
                          onClick={() =>
                            setProjectOffersExpanded((expanded) => !expanded)
                          }
                          aria-expanded={projectOffersExpanded}
                          className={cn(BTN_OUTLINE, "mt-gap-md")}
                        >
                          {projectOffersExpanded ? "Ver menos" : "Ver todo"}
                          <ChevronDown
                            size={16}
                            strokeWidth={1.8}
                            className={cn(
                              CHEVRON,
                              projectOffersExpanded && "rotate-180",
                            )}
                          />
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-small leading-relaxed text-ink-soft/75">
                      Este proyecto aún no ha añadido información sobre lo que
                      ofrece.
                    </p>
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
                      id="menu-see-all-trigger"
                      onClick={() => {
                        setMenuExpanded(!menuExpanded);
                        onMenuSeeAll?.();
                      }}
                      aria-expanded={menuExpanded}
                      aria-controls="full-menu-list"
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
                  <div id="full-menu-list">
                    <MenuPages items={place.menu} variant="list" />
                  </div>
                </>
              )}
            </section>
          </Reveal>

          {/* Reseñas, las últimas: arriba quedan el nombre, la descripción, los
              pagos y el contacto, que es lo que se lee para decidir, y lo que
              ofrece el negocio. Antes iban entre el menú y la oferta y partían
              en dos esa parte. */}
          {!place.isProject && (
            <Reveal>
              <section className="p-gap-lg px-gutter bg-sand-warm">
                <ReviewsSection placeId={place.id} reloadKey={reviewsKey} />
              </section>
            </Reveal>
          )}

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
        <Dialog
          open={activeProjectPhoto !== null}
          onOpenChange={(open) => {
            if (!open) setProjectPhotoIndex(null);
          }}
        >
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
                      onClick={() =>
                        setProjectPhotoIndex((index) =>
                          index === null
                            ? null
                            : (index - 1 + projectPhotos.length) %
                              projectPhotos.length,
                        )
                      }
                      aria-label="Foto anterior"
                      className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-ink/70 text-white hover:bg-ink/90"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setProjectPhotoIndex((index) =>
                          index === null
                            ? null
                            : (index + 1) % projectPhotos.length,
                        )
                      }
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
            <h3 className="font-lv-display text-small font-semibold text-ink">
              {offer.title || `Oferta ${index + 1}`}
            </h3>
            {offer.price && (
              <span className="font-lv-display text-small font-semibold text-verde-700">
                {offer.price}
              </span>
            )}
          </div>
          {(offer.capacity || offer.validUntil) && (
            <p className="mt-1 text-meta text-ink-soft/70">
              {[
                offer.capacity ? `${offer.capacity} personas` : "",
                offer.validUntil ? `Vigente hasta ${offer.validUntil}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {offer.includes.length > 0 && (
            <ul className="mt-gap-xs flex flex-col gap-1 text-small leading-relaxed text-ink-soft/85">
              {offer.includes.map((item, itemIndex) => (
                <li key={`${offer.id}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          )}
          {offer.conditions && (
            <p className="mt-gap-xs whitespace-pre-wrap text-small leading-relaxed text-ink-soft/75">
              {offer.conditions}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Los enlaces que el dueño rellenó en la sección «Contacto» de su formulario:
 * sitio web, WhatsApp, Instagram y Facebook.
 *
 * Va como tarjeta aparte y no dentro de los `ActionButtons`: esas cuatro son
 * acciones **de La Verde** —llegar, guardar, compartir, opinar— y estas son del
 * negocio, que se abren fuera. Mezclarlas en la misma rejilla de cuatro las
 * habría obligado a decidir cuál se queda sin pintar cuando el dueño solo
 * rellena dos, y una rejilla con huecos se lee como algo roto.
 *
 * Sin ningún enlace no pinta nada, que es lo que quiere decir «este negocio no
 * dio sus contactos»: no un bloque con la cabecera sola.
 */
function ContactCard({
  place,
  className,
}: {
  place: PlaceData;
  className?: string;
}) {
  const { website, whatsapp, instagram, facebook } = place.contact;

  /* Cada enlace lleva su evento: el clic es la única señal de que este contacto
     sirvió, y solo existe aquí, en el navegador. `business_contact_clicked`
     resume el gesto; los tipos concretos permiten desglosarlo por canal. */
  const rows: {
    label: string;
    href: string;
    icon: LucideIcon;
    event: AnalyticsEventType;
  }[] = [];
  if (whatsapp)
    rows.push({
      label: "WhatsApp",
      href: whatsapp,
      icon: MessageCircle,
      event: "business_whatsapp_clicked",
    });
  if (website)
    rows.push({
      label: "Sitio web",
      href: website,
      icon: Globe,
      event: "business_website_clicked",
    });
  if (instagram)
    rows.push({
      label: "Instagram",
      href: instagram,
      icon: Instagram,
      event: "business_social_clicked",
    });
  if (facebook)
    rows.push({
      label: "Facebook",
      href: facebook,
      icon: Facebook,
      event: "business_social_clicked",
    });

  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-ink/5 shadow-soft p-gap-md",
        className,
      )}
    >
      <div className="font-lv-display text-small font-semibold text-ink mb-gap-sm">
        Contacto
      </div>
      {/* En fila y no apilados. Cuatro botones de 44 px uno debajo de otro son
          200 px de alto para decir cuatro palabras; a 12 px y sin la flecha de
          «se abre fuera» tres caben en la misma línea de un móvil —unos 300 de
          los 350 px que quedan entre márgenes— y el cuarto baja solo. Los 36 px
          de alto quedan por debajo de los 44 de un dedo pero por encima de los
          24 que pide WCAG 2.5.8 AA, y el ancho lo compensa. */}
      <div className="flex flex-wrap items-center gap-[6px]">
        {rows.map((row) => (
          <a
            key={row.label}
            href={row.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackClientEvent(row.event, { businessId: place.id })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 font-lv-display text-[12px] font-semibold text-ink transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600"
          >
            <row.icon
              size={15}
              strokeWidth={1.8}
              className="shrink-0 text-verde-600"
            />
            <span className="truncate">{row.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
