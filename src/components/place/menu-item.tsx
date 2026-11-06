"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { Image as ImageIcon, Minus, Plus } from "lucide-react";
import { cn, formatMenuPrice, menuTagFallback, menuTagStyles } from "@/lib/utils";
import { estaAgotado, type Disponibilidad } from "@/lib/disponibilidad";
import { preciosDeItem, type ConfigTasa } from "@/lib/precios";

interface MenuItemProps {
  name: string;
  description: string;
  /** Texto libre, como lo escribió el dueño. Ver `UserPlaceMenuItem`. */
  price: string;
  currency: string;
  tag?: string;
  /**
   * Familia del producto («Entrantes», «Bebidas»). Opcional: media carta no la
   * tiene, y sin ella la fila se lee igual. Ver `UserPlaceMenuItem`.
   *
   * La tarjeta no la pinta —es el chip de la esquina inferior el que se quitó—,
   * pero tiene que seguir en el tipo: los chips de arriba, que sí filtran,
   * sacan de aquí la lista de familias.
   */
  category?: string;
  /**
   * Foto que el dueño puso al producto desde «Lo que ofrece». Sin ella el hueco
   * se queda con el icono de «aquí iría una foto»: mismo dibujo en todas las
   * plataformas, al contrario que un emoji, que cada sistema pinta a su aire.
   */
  image?: string;
  /** «Hoy hay»: estado guardado del producto. Ver `disponibilidad.ts`. */
  disponibilidad?: Disponibilidad;
  agotadoHasta?: number | null;
  /**
   * El precio con oferta flash: el de antes, para tacharlo, y el de ahora.
   *
   * Viene **ya resuelto** y sin la moneda —la pone la fila, que es quien la
   * tiene—. Lo calcula `precioConOferta` al construir el `PlaceData`, y solo
   * llega cuando de verdad hay algo que tachar: un descuento por porcentaje
   * sobre un precio que no es una cifra («3–5 USD») no puede con él.
   */
  oferta?: { de: string; por: string };
  /**
   * Texto de stock calculado por el catálogo según `existenciasModo`: «Quedan
   * pocas», «Quedan 3», etc. `undefined` = no mostrar nada extra.
   */
  stockBadge?: string;
  /**
   * Duración estimada del servicio, en minutos. Solo para el módulo servicios.
   */
  duracionMin?: number;
  /**
   * Tipo de precio. Afecta cómo se muestra el precio:
   * - `consultar` → «A consultar» en lugar del precio
   * - `desde` → «Desde X» como prefijo
   * - `fijo` (o sin definir) → precio tal cual
   */
  tipoPrecio?: "fijo" | "desde" | "consultar";
  /**
   * Cantidad actual en el carrito. Solo se muestra el control cuando
   * `onAgregar` está definido y el ítem no está agotado.
   */
  qty?: number;
  onAgregar?: () => void;
  onQuitar?: () => void;
  /** URL de WhatsApp por ítem (módulo servicios). */
  hrefCita?: string;
  className?: string;
  index?: number;
  configTasa?: ConfigTasa | null;
}

/**
 * La tarjeta de producto de «Lo que ofrece», en la ficha del negocio.
 *
 * Cuando `onAgregar` está presente (módulo domicilio activo y pedidos
 * habilitados) muestra un control `+/-` integrado; sin él, es solo lectura.
 */
export function MenuItem({
  name,
  description,
  price,
  currency,
  tag,
  image,
  disponibilidad,
  agotadoHasta,
  oferta,
  stockBadge,
  duracionMin,
  tipoPrecio,
  qty,
  onAgregar,
  onQuitar,
  hrefCita,
  className,
  index = 0,
  configTasa = null,
}: MenuItemProps) {
  const rawPriceText = formatMenuPrice(price, currency);
  const { secundario } = preciosDeItem({ price, currency }, configTasa);
  /* `tipoPrecio` cambia cómo se presenta el precio:
     - consultar → texto fijo, independientemente del campo precio
     - desde     → prefijo «Desde» delante del precio formateado
     - fijo/undef → el precio tal cual */
  const priceText =
    tipoPrecio === "consultar"
      ? "A consultar"
      : tipoPrecio === "desde" && rawPriceText
        ? `Desde ${rawPriceText}`
        : rawPriceText;
  const agotado = estaAgotado({ disponibilidad, agotadoHasta });
  const enOferta = Boolean(oferta && rawPriceText && tipoPrecio !== "consultar");
  const conCarrito = Boolean(onAgregar && !agotado);
  const enCarrito = (qty ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex flex-col rounded-2xl border border-ink/10 bg-white p-gap-xs shadow-soft sm:p-gap-sm",
        agotado && "opacity-60",
        className,
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-lv-lg border border-ink/5 bg-sand-deep text-verde-600">
        {image ? (
          <Image
            src={image}
            alt={name ? `Foto de ${name}` : ""}
            fill
            sizes="(min-width: 768px) 440px, 45vw"
            quality={70}
            className={cn("object-cover", agotado && "grayscale")}
          />
        ) : (
          <span
            className={cn(
              "absolute inset-0 grid place-items-center",
              agotado && "grayscale",
            )}
          >
            <ImageIcon size={28} strokeWidth={1.8} className="opacity-50" />
          </span>
        )}
        {(enOferta || agotado || stockBadge) && (
          <span className="absolute left-[6px] top-[6px] flex flex-wrap gap-[4px]">
            {enOferta && (
              <span className="rounded-full bg-verde-400 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-verde-950">
                Oferta
              </span>
            )}
            {agotado && (
              <span className="rounded-full bg-white/95 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-destructive">
                Agotado
              </span>
            )}
            {stockBadge && !agotado && (
              <span className="rounded-full bg-white/95 px-[8px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft/80">
                {stockBadge}
              </span>
            )}
          </span>
        )}
        {/* Botón + flotante en la esquina inferior derecha cuando hay carrito y
            el ítem todavía no se añadió. Cuando ya hay unidades, el control
            completo va debajo. */}
        {conCarrito && !enCarrito && (
          <button
            type="button"
            onClick={onAgregar}
            aria-label={`Añadir ${name} al pedido`}
            className="absolute bottom-[6px] right-[6px] grid size-9 place-items-center rounded-full bg-verde-400 text-verde-950 shadow-primary-halo transition-colors duration-300 hover:bg-verde-300 active:scale-95"
          >
            <Plus size={18} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="mt-gap-sm flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 min-h-[2.75em] font-lv-display text-body font-bold leading-snug text-ink sm:text-h3">
          {name}
        </span>
        <div className="line-clamp-2 min-h-[2.75em] text-small leading-snug text-ink-soft/75 sm:text-body">
          {description}
        </div>
        <div className="mt-auto flex min-h-[calc(2.75em+6px)] flex-wrap items-center gap-gap-xs pt-[6px] sm:min-h-0">
          {enOferta && oferta ? (
            <span className="flex items-baseline gap-gap-xs">
              <span className="font-lv-display text-meta text-ink-soft/60 line-through">
                {formatMenuPrice(oferta.de, currency)}
              </span>
              <span className="font-lv-display text-small font-semibold text-verde-600">
                {formatMenuPrice(oferta.por, currency)}
              </span>
            </span>
          ) : (
            priceText && (
              <span className="flex flex-col">
                <span className="font-lv-display text-body font-bold leading-snug text-ink sm:text-h3">
                  {priceText}
                </span>
                {secundario && (
                  <span className="tabular-nums text-[13px] leading-none text-ink-soft/60">
                    {secundario}
                  </span>
                )}
              </span>
            )
          )}
          <span className="ml-auto flex flex-wrap items-center gap-gap-xs">
            {tag && (
              <span
                className={cn(
                  "px-[8px] py-[2px] rounded-full font-lv-display text-[10px] font-semibold uppercase tracking-[0.16em]",
                  menuTagStyles[tag] ?? menuTagFallback,
                )}
              >
                {tag}
              </span>
            )}
          </span>
        </div>

        {/* Control +/- cuando el ítem ya está en el carrito. Va dentro del
            cuerpo de texto para no cambiar el alto de la tarjeta vacía. */}
        {/* Duración del servicio */}
        {duracionMin && (
          <span className="mt-[2px] font-lv-display text-meta text-ink-soft/60">
            {duracionMin} min
          </span>
        )}

        {/* Botón de pedir cita por WhatsApp (módulo servicios) */}
        {hrefCita && !agotado && (
          <a
            href={hrefCita}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-gap-xs inline-flex h-8 items-center justify-center rounded-full bg-verde-400 px-gap-sm font-lv-display text-meta font-semibold text-verde-950 transition-colors duration-300 hover:bg-verde-300 active:scale-95"
          >
            Pedir cita
          </a>
        )}

        {/* Control +/- del carrito */}
        {conCarrito && enCarrito && (
          <div className="mt-gap-xs flex items-center justify-between gap-gap-xs rounded-xl border border-verde-200 bg-verde-50 px-gap-sm py-[5px]">
            <button
              type="button"
              onClick={onQuitar}
              aria-label={`Quitar una unidad de ${name}`}
              className="grid size-7 place-items-center rounded-full text-verde-700 transition-colors hover:bg-verde-100 active:scale-95"
            >
              <Minus size={15} strokeWidth={2} />
            </button>
            <span className="font-lv-display text-small font-bold text-verde-800">
              {qty}
            </span>
            <button
              type="button"
              onClick={onAgregar}
              aria-label={`Añadir otra unidad de ${name}`}
              className="grid size-7 place-items-center rounded-full text-verde-700 transition-colors hover:bg-verde-100 active:scale-95"
            >
              <Plus size={15} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
