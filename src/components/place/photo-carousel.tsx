"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import NextImage from "next/image";
import { ChevronLeft, ChevronRight, Image } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Una diapositiva del carrusel.
 *
 * `url` a `null` es un negocio sin fotos subidas: se pinta el degradado de
 * relleno del design system, con su rótulo. El hueco se ve como el diseño, no
 * como un error. Antes esto era siempre un degradado: las fotos no existían.
 */
export interface Slide {
  url: string | null;
  alt: string;
  /**
   * El tamaño real de la foto, cuando se conoce. Lo usa la portada para que el
   * marco la siga en vez de forzarle una proporción fija. Ver `proporcion`.
   */
  width?: number | null;
  height?: number | null;
  /** Solo cuando no hay foto. */
  gradient?: string;
  /** Solo cuando no hay foto. */
  label?: string;
}

interface PhotoCarouselProps {
  slides: Slide[];
  hasPhotos?: boolean;
  className?: string;
}

/** Cada cuánto pasa sola la diapositiva, en milisegundos. */
const AUTOPLAY_MS = 3000;

export function PhotoCarousel({ slides, hasPhotos = true, className }: PhotoCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const isDragging = useRef(false);

  const total = slides.length;

  /* El marco sigue la proporción de la portada —es la foto que se ve primero—,
     en vez de forzar 16/9 sobre cualquier foto. Una foto apaisada metida en un
     marco más cuadrado se recorta por los lados y parece ampliada: el marco
     manda sobre la foto, cuando es la foto la que debería mandar.

     Con tope, y no la proporción pelada: una foto muy apaisada dejaría una
     franja de dos dedos y una vertical un marco altísimo que se come la
     pantalla. Entre 4/3 y 21/9 cabe casi todo sin recortes y sin sustos.
     Sin medidas —las fotos del fixture o las que aún no se han reencodeado— se
     queda la proporción de siempre, la de las clases. */
  const portada = slides[0];
  const proporcion =
    portada?.width && portada?.height
      ? Math.min(21 / 9, Math.max(4 / 3, portada.width / portada.height))
      : null;

  const goTo = useCallback(
    (i: number) => {
      setCurrent(Math.max(0, Math.min(i, total - 1)));
    },
    [total],
  );

  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(-${current * 100}%)`;
    }
  }, [current]);

  /* Avance solo. Se para con el puntero encima o con el foco del teclado dentro
     —un carrusel que no se puede detener es un fallo de accesibilidad (WCAG
     2.2.2)— y no arranca siquiera si el sistema pide movimiento reducido. El
     gesto táctil también lo para mientras dura, y al soltar el contador vuelve
     a empezar: así no te cambia la foto justo después de haberla movido tú.
     Solo desde la segunda foto tiene sentido, y `total` lo decide. */
  useEffect(() => {
    if (paused || total < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(
      () => setCurrent((c) => (c + 1) % total),
      AUTOPLAY_MS,
    );
    return () => clearInterval(id);
  }, [paused, total]);

  /* El tipo de puntero y no el evento a secas: en táctil el navegador emula
     `mouseenter` sobre lo que acabas de tocar, y con eso el carrusel se quedaba
     parado hasta el siguiente toque en otro sitio. */
  const pauseForMouse = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setPaused(true);
  }, []);
  const resumeForMouse = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setPaused(false);
  }, []);
  /* Y `:focus-visible` y no el foco a secas, por lo mismo: pulsar una flecha con
     el ratón también enfoca el botón, y el foco se queda ahí después de irte. */
  const pauseForKeyboard = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && e.target.matches(":focus-visible")) {
      setPaused(true);
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      /* Con una sola foto no hay a dónde ir: sin este corte, el arrastre movía
         el carril igual y dejaba ver el fondo vacío por el lado. */
      if (total < 2) return;
      const touch = e.touches[0];
      if (!touch) return;
      setPaused(true);
      touchStartX.current = touch.clientX;
      touchDeltaX.current = 0;
      isDragging.current = true;
      if (trackRef.current) trackRef.current.style.transition = "none";
    },
    [total],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchDeltaX.current = touch.clientX - touchStartX.current;
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(calc(-${current * 100}% + ${touchDeltaX.current}px))`;
    }
  }, [current]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    setPaused(false);
    if (trackRef.current) trackRef.current.style.transition = "";
    if (Math.abs(touchDeltaX.current) > 50) {
      goTo(touchDeltaX.current > 0 ? current - 1 : current + 1);
    }
  }, [current, goTo]);

  if (!hasPhotos) {
    return (
      <div className={cn("relative w-full aspect-[4/3] lg:aspect-[16/9] overflow-hidden bg-sand-deep", className)}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-gap-xs text-ink-soft/75">
          <Image size={40} strokeWidth={1.5} className="opacity-40" />
          <span className="text-small font-lv-display">Fotos próximamente</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("group relative w-full aspect-[4/3] lg:aspect-[16/9] overflow-hidden bg-sand-deep lg:rounded-4xl", className)}
      /* Va en estilo y no en clase porque la proporción es un número, no una
         escala: gana a `aspect-[…]` y deja las clases de arriba como el marco de
         siempre para cuando no hay medidas. */
      style={proporcion ? { aspectRatio: String(proporcion) } : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onPointerEnter={pauseForMouse}
      onPointerLeave={resumeForMouse}
      onFocus={pauseForKeyboard}
      onBlur={() => setPaused(false)}
    >
      {/* `duration-slow` no existe en la escala de Tailwind: compilaba a cero y
          el carril saltaba de golpe en vez de deslizar. */}
      <div ref={trackRef} className="flex h-full transition-transform duration-500 ease-outquint will-change-transform">
        {slides.map((slide, i) => (
          <div key={i} className="flex-[0_0_100%] h-full relative">
            {slide.url ? (
              <NextImage
                src={slide.url}
                alt={slide.alt}
                fill
                /* El carrusel ocupa la ficha entera en móvil y la columna de
                   contenido en escritorio. `priority` solo en la primera: es la
                   que decide el LCP de la página. */
                sizes="(min-width: 1024px) 1200px, 100vw"
                priority={i === 0}
                className="object-cover"
              />
            ) : (
              <div
                /* `slide-fallback` da punto de ancla al modo oscuro: el degradado
                    llega como estilo inline y solo un `!important` desde CSS lo
                    puede sustituir cuando el tema cambia. */
                className="slide-fallback w-full h-full flex flex-col items-center justify-center gap-gap-xs text-verde-600"
                style={{ background: slide.gradient }}
              >
                <Image size={40} strokeWidth={1.5} className="opacity-40" />
                <span className="text-small font-lv-display">{slide.label}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Counter. Con una sola foto no dice nada —«1 / 1»— y el punto tampoco:
          los dos hablan de un recorrido que no existe. */}
      {total > 1 && (
        <div className="absolute top-gap-xs right-gap-xs bg-ink/70 backdrop-blur-sm text-white font-lv-display text-meta font-semibold px-[10px] py-[4px] rounded-full">
          {current + 1} / {total}
        </div>
      )}

      {/* Dots. El área táctil es 24x44 (cumple WCAG 2.5.8 AA) aunque el punto
          visible siga siendo de 7px: el botón alinea su contenido abajo para que
          el punto no se mueva de sitio respecto al diseño anterior.

          Van en tinta y no en blanco porque la ficha disuelve el borde inferior
          de la foto en el fondo: a la altura del punto ya no hay imagen debajo,
          hay arena, y unos puntos blancos sobre arena no se ven. Mismos colores
          que los del carril de la portada.

          El 13% los deja justo por encima del desvanecido, que en la ficha
          arranca a esa misma altura: es la única cifra que comparten los dos. */}
      {total > 1 && (
        <div className="absolute bottom-[13%] left-1/2 -translate-x-1/2 flex">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className="flex h-11 w-6 items-end justify-center"
              aria-label={`Ir a foto ${i + 1}`}
              aria-current={i === current}
            >
              <span
                className={cn(
                  "block h-[7px] rounded-full transition-[width,background-color] duration-500 ease-outquint",
                  i === current
                    ? "w-[20px] bg-verde-600"
                    : "w-[7px] bg-ink/20",
                )}
              />
            </button>
          ))}
        </div>
      )}

      {/* Nav buttons. En táctil van SIEMPRE visibles: `group-hover` no existe sin
          ratón, así que con el patrón anterior las flechas eran inalcanzables en
          teléfono. Solo se ocultan donde de verdad hay hover. */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            className="absolute top-1/2 -translate-y-1/2 left-gap-xs size-11 rounded-full bg-white/85 backdrop-blur grid place-items-center shadow-soft text-ink transition duration-500 ease-outquint hover:bg-white hover:shadow-card [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
            aria-label="Foto anterior"
          >
            <ChevronLeft size={18} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            className="absolute top-1/2 -translate-y-1/2 right-gap-xs size-11 rounded-full bg-white/85 backdrop-blur grid place-items-center shadow-soft text-ink transition duration-500 ease-outquint hover:bg-white hover:shadow-card [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
            aria-label="Foto siguiente"
          >
            <ChevronRight size={18} strokeWidth={1.8} />
          </button>
        </>
      )}
    </div>
  );
}
