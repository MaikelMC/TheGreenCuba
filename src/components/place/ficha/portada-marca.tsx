import { Image as ImageIcon } from "lucide-react";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { placeIcon } from "@/lib/places";
import { posicionPortada } from "@/lib/ficha/tipos";
import { COPY } from "@/config/ficha";
import { cn } from "@/lib/utils";
import { PhotoCarousel, type Slide } from "../photo-carousel";

/**
 * La portada de la ficha.
 *
 * Tres estados, y ninguno inventa contenido: con fotos, el carrusel; sin fotos
 * pero con `color_marca`, un campo de color con el nombre como marca de agua; y
 * sin ninguna de las dos, la arena de la casa con un aviso honesto de que
 * todavía no hay fotos. El degradado verde y las etiquetas «El lugar» /
 * «Ambiente» que había antes no eran del negocio y desaparecieron.
 */
export function PortadaMarca({
  name,
  category,
  icon,
  slides,
  colorMarca,
  portadaEncuadre,
  className,
}: {
  name: string;
  category: string;
  icon?: string;
  slides: Slide[];
  colorMarca?: string | null;
  portadaEncuadre?: string | null;
  className?: string;
}) {
  const Icono = resolveCategoryIcon(placeIcon(icon, category));

  if (slides.length > 0) {
    return (
      <PhotoCarousel
        slides={slides}
        hasPhotos
        objectPosition={posicionPortada(
          portadaEncuadre === "arriba" || portadaEncuadre === "abajo"
            ? portadaEncuadre
            : "centro",
        )}
        className={className}
      />
    );
  }

  if (colorMarca) {
    return (
      <div
        className={cn(
          "relative w-full aspect-[4/3] overflow-hidden bg-sand-deep lg:aspect-[16/9]",
          className,
        )}
        style={{ backgroundColor: colorMarca }}
      >
        {/* Una textura de puntos muy tenue: da profundidad sin pedir una foto
            ni afirmar nada del negocio. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/30"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-8 -right-4 select-none font-lv-display text-[clamp(84px,20vw,220px)] font-bold leading-none tracking-[-0.05em] text-white/15"
        >
          {name}
        </span>
        <div className="relative flex h-full flex-col justify-end p-gap-lg">
          <span className="inline-flex items-center gap-gap-xs font-lv-display text-meta font-semibold uppercase tracking-[0.14em] text-white/70">
            <Icono size={14} strokeWidth={1.8} />
            {category}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative grid w-full aspect-[4/3] place-items-center overflow-hidden bg-sand-deep lg:aspect-[16/9]",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-gap-xs text-ink-soft/60">
        <ImageIcon size={40} strokeWidth={1.5} className="opacity-40" />
        <span className="font-lv-display text-small">{COPY.sinFotos}</span>
      </div>
    </div>
  );
}
