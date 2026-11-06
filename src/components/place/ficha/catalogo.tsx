"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, MessageCircle, Minus, Plus, Search } from "lucide-react";
import { cn, formatMenuPrice, menuTagFallback, menuTagStyles } from "@/lib/utils";
import { estaAgotado } from "@/lib/disponibilidad";
import { preciosDeItem, type ConfigTasa } from "@/lib/precios";
import type { PlaceMenu, PlacePhoto } from "@/lib/ficha/place-data";
import type { EspecialDelDia, ExistenciasModo, MenuCategoria, ModuloFicha, TipoNegocio } from "@/lib/ficha/tipos";
import { ordenarCategorias, COPY } from "@/config/ficha";

/* ── Tokens de estilo compartidos ─────────────────────────────────────── */

const CHIP =
  "h-8 shrink-0 whitespace-nowrap px-gap-sm rounded-full border font-lv-display text-meta font-semibold cursor-pointer transition duration-300";
const CHIP_ON = "bg-verde-400 border-verde-400 text-verde-950";
const CHIP_OFF = "bg-white border-ink/10 text-ink-soft/75 hover:border-verde-300 hover:text-verde-600";

const BTN_OUTLINE =
  "inline-flex h-10 items-center justify-center gap-gap-xs rounded-full border border-ink/10 bg-white px-gap-md font-lv-display text-meta font-semibold text-ink transition-colors duration-300 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600";

const AGOTADO_LABEL = "text-[12px] font-bold text-[#8A2F1F]";

/* Cuántos ítems por página en la lista de cafetería. El mismo número que la
   vista de domicilio: son la misma clase de lista y se leen igual. */
const PAGE_TEXTO = 5;

const PAGE_BTN =
  "grid size-9 place-items-center rounded-full border border-ink/10 bg-white text-ink transition-colors duration-300 hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 disabled:opacity-35 disabled:pointer-events-none cursor-pointer";

/* ── Helpers ───────────────────────────────────────────────────────────── */

type Vista = "lista_foto" | "lista_texto" | "cuadricula" | "servicios";

function determinarVista(
  tipoNegocio: TipoNegocio | null | undefined,
  modulosActivos: ModuloFicha[],
): Vista {
  if (modulosActivos.includes("servicios") || tipoNegocio === "servicios")
    return "servicios";
  if (modulosActivos.includes("tienda") || tipoNegocio === "tienda_mipyme")
    return "cuadricula";
  if (modulosActivos.includes("local") || tipoNegocio === "cafeteria_restaurante")
    return "lista_texto";
  if (modulosActivos.includes("domicilio") || tipoNegocio === "comida_domicilio")
    return "lista_foto";
  return "lista_texto"; // fallback limpio sin placeholders
}

function hrefCitaItem(whatsapp: string, item: PlaceMenu): string {
  const texto = encodeURIComponent(
    `Hola, quiero pedir una cita para ${item.name}${item.duracionMin ? ` (${item.duracionMin} min)` : ""}.`,
  );
  const base = whatsapp.startsWith("https://")
    ? whatsapp
    : `https://wa.me/${whatsapp.replace(/\D/g, "")}`;
  return `${base}?text=${texto}`;
}

function formatPrecioItem(item: PlaceMenu): string {
  if (item.tipoPrecio === "consultar") return "A consultar";
  const raw = formatMenuPrice(item.price, item.currency);
  if (!raw) return "";
  return item.tipoPrecio === "desde" ? `Desde ${raw}` : raw;
}

function stockTexto(item: PlaceMenu, modo: ExistenciasModo): string | undefined {
  if (modo === "ninguna") return undefined;
  if (estaAgotado(item)) return undefined;
  if (modo === "pocas" && item.stock !== undefined && item.stock > 0 && item.stock < 5)
    return COPY.pocas;
  if (modo === "exacta" && item.stock !== undefined && item.stock > 0)
    return COPY.quedan(item.stock);
  return undefined;
}

function agotadoFecha(item: PlaceMenu): string | null {
  if (!item.agotadoHasta) return null;
  const diff = item.agotadoHasta - Date.now();
  if (diff <= 0) return null;
  const dias = Math.ceil(diff / 86_400_000);
  if (dias <= 1) return "Vuelve mañana";
  const nombres = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const d = new Date(item.agotadoHasta).getDay();
  return `Vuelve el ${nombres[d]}`;
}

/* ── Botón +/− de carrito ─────────────────────────────────────────────── */

function BtnCarrito({
  item,
  carrito,
  onAgregar,
  onQuitar,
  size = "md",
}: {
  item: PlaceMenu;
  carrito: Record<string, number>;
  onAgregar: (id: string) => void;
  onQuitar: (id: string) => void;
  size?: "sm" | "md";
}) {
  if (!item.id) return null;
  const qty = carrito[item.id] ?? 0;
  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => onAgregar(item.id!)}
        aria-label={`Añadir ${item.name} al pedido`}
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-verde-400 text-verde-950 shadow-primary-halo transition-colors duration-300 hover:bg-verde-300 active:scale-95",
          size === "sm" ? "size-8" : "size-11",
        )}
      >
        <Plus size={size === "sm" ? 15 : 20} strokeWidth={2} />
      </button>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-gap-xs rounded-full bg-[#E3F1E5] px-gap-sm py-[6px]">
      <button
        type="button"
        onClick={() => onQuitar(item.id!)}
        aria-label={`Quitar una unidad de ${item.name}`}
        className="grid size-6 place-items-center text-verde-700 active:scale-95"
      >
        <Minus size={13} strokeWidth={2} />
      </button>
      <span className="min-w-[16px] text-center font-lv-display text-small font-bold text-verde-800">
        {qty}
      </span>
      <button
        type="button"
        onClick={() => onAgregar(item.id!)}
        aria-label={`Añadir otra unidad de ${item.name}`}
        className="grid size-6 place-items-center text-verde-700 active:scale-95"
      >
        <Plus size={13} strokeWidth={2} />
      </button>
    </div>
  );
}

/* ── Vista lista con foto (domicilio) ────────────────────────────────── */

function FilaConFoto({
  item,
  carrito,
  onAgregar,
  onQuitar,
  agotado,
  configTasa = null,
}: {
  item: PlaceMenu;
  carrito?: Record<string, number>;
  onAgregar?: (id: string) => void;
  onQuitar?: (id: string) => void;
  agotado: boolean;
  configTasa?: ConfigTasa | null;
}) {
  const precio = formatPrecioItem(item);
  const fechaVuelta = agotado ? agotadoFecha(item) : null;
  const tieneFoto = Boolean(item.image);

  return (
    <div
      className={cn(
        "flex items-center gap-[10px] border-b border-[#EEEBE3] py-[10px] last:border-b-0",
        agotado && "opacity-60",
      )}
    >
      {/* Miniatura — siempre presente; fondo neutro cuando no hay foto */}
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-[12px] bg-sand-deep",
          agotado ? "size-14" : "size-[76px]",
        )}
      >
        {tieneFoto && (
          <Image
            src={item.image!}
            alt={item.name}
            fill
            sizes="76px"
            className={cn("object-cover", agotado && "grayscale")}
            loading="lazy"
          />
        )}
      </div>

      {/* Texto */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[5px]">
          <span className="truncate font-lv-display text-[15px] font-bold text-[#1C2620]">
            {item.name}
          </span>
          {item.tag && (
            <span
              className={cn(
                "shrink-0 rounded-full px-[7px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em]",
                menuTagStyles[item.tag] ?? menuTagFallback,
              )}
            >
              {item.tag}
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-[2px] truncate text-[13px] text-[#5B6660]">
            {item.description}
          </p>
        )}
        {precio && !agotado && (
          <>
            <p className="mt-[4px] font-lv-display text-[15px] font-[800] text-ink">
              {item.oferta ? (
                <span className="flex items-baseline gap-gap-xs">
                  <span className="text-[13px] font-normal text-ink-soft/60 line-through">
                    {formatMenuPrice(item.oferta.de, item.currency)}
                  </span>
                  <span className="text-verde-700">
                    {formatMenuPrice(item.oferta.por, item.currency)}
                  </span>
                </span>
              ) : (
                precio
              )}
            </p>
            {(() => {
              const src = item.oferta ? { price: item.oferta.por, currency: item.currency } : item;
              const { secundario } = preciosDeItem(src, configTasa);
              return secundario ? (
                <span className="mt-[2px] block tabular-nums text-[13px] leading-none text-ink-soft/60">
                  {secundario}
                </span>
              ) : null;
            })()}
          </>
        )}
      </div>

      {/* Acción */}
      <div className="shrink-0">
        {agotado ? (
          <span className={AGOTADO_LABEL}>{fechaVuelta ?? "Agotado"}</span>
        ) : carrito && onAgregar && onQuitar ? (
          <BtnCarrito
            item={item}
            carrito={carrito}
            onAgregar={onAgregar}
            onQuitar={onQuitar}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ── Vista lista de texto (cafetería) ────────────────────────────────── */

function FilaTexto({
  item,
  carrito,
  onAgregar,
  onQuitar,
  agotado,
  configTasa = null,
}: {
  item: PlaceMenu;
  carrito?: Record<string, number>;
  onAgregar?: (id: string) => void;
  onQuitar?: (id: string) => void;
  agotado: boolean;
  configTasa?: ConfigTasa | null;
}) {
  const precio = formatPrecioItem(item);

  return (
    <div
      className={cn(
        "flex items-center gap-gap-sm border-b border-[#EEEBE3] py-[10px] last:border-b-0",
        agotado && "opacity-60",
      )}
    >
      {/* La foto del producto abre la fila, a la izquierda de la información,
          igual que en la vista de domicilio. Sin foto no se pinta el hueco: en
          una cafetería muchos platos no la tienen y una columna de cuadros
          vacíos se leería como algo roto. `sizes` en 56 px: no crece. */}
      {item.image && (
        <div className="relative size-14 shrink-0 overflow-hidden rounded-[12px] bg-sand-deep">
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="56px"
            className={cn("object-cover", agotado && "grayscale")}
            loading="lazy"
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[5px]">
          <span className="truncate font-lv-display text-[15px] font-bold text-[#1C2620]">
            {item.name}
          </span>
          {item.tag && (
            <span
              className={cn(
                "shrink-0 rounded-full px-[7px] py-[2px] font-lv-display text-[10px] font-semibold uppercase tracking-[0.12em]",
                menuTagStyles[item.tag] ?? menuTagFallback,
              )}
            >
              {item.tag}
            </span>
          )}
        </div>
        {item.description && (
          <p className="truncate text-[13px] text-[#5B6660]">{item.description}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-gap-sm">
        {agotado ? (
          <span className={AGOTADO_LABEL}>Agotado</span>
        ) : (
          <>
            {precio && (
              <span className="flex flex-col items-end">
                <span className="font-lv-display text-[15px] font-[800] whitespace-nowrap text-ink">
                  {precio}
                </span>
                {(() => {
                  const { secundario } = preciosDeItem(item, configTasa);
                  return secundario ? (
                    <span className="tabular-nums text-[12px] leading-none text-ink-soft/60">
                      {secundario}
                    </span>
                  ) : null;
                })()}
              </span>
            )}
            {carrito && onAgregar && onQuitar && (
              <BtnCarrito
                item={item}
                carrito={carrito}
                onAgregar={onAgregar}
                onQuitar={onQuitar}
                size="sm"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Las flechas y el «1 / 3» del paginado. */
function Paginador({
  pagina,
  total,
  onChange,
  etiqueta,
}: {
  pagina: number;
  total: number;
  onChange: (siguiente: number) => void;
  etiqueta: string;
}) {
  if (total <= 1) return null;

  return (
    <div className="mt-gap-sm flex items-center justify-between gap-gap-xs">
      <button
        type="button"
        onClick={() => onChange(pagina - 1)}
        disabled={pagina === 0}
        aria-label={`Página anterior de ${etiqueta}`}
        className={PAGE_BTN}
      >
        <ChevronLeft size={16} strokeWidth={2} />
      </button>

      <span className="font-lv-display text-meta text-ink-soft/60">
        {pagina + 1} / {total}
      </span>

      <button
        type="button"
        onClick={() => onChange(pagina + 1)}
        disabled={pagina === total - 1}
        aria-label={`Página siguiente de ${etiqueta}`}
        className={PAGE_BTN}
      >
        <ChevronRight size={16} strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * Un grupo de la carta de cafetería: el título de la categoría y sus platos,
 * paginados igual que la lista de domicilio —cinco por página, con flechas y
 * arrastre—.
 *
 * La paginación va por grupo y no sobre la carta entera porque las categorías
 * son la forma de navegarla: con veinte desayunos y treinta bebidas, una sola
 * página escondía media carta detrás de flechas sin decir de qué era cada una.
 */
function GrupoTexto({
  cat,
  items,
  carrito,
  onAgregar,
  onQuitar,
  configTasa = null,
}: {
  cat: string | null;
  items: PlaceMenu[];
  carrito?: Record<string, number>;
  onAgregar?: (id: string) => void;
  onQuitar?: (id: string) => void;
  configTasa?: ConfigTasa | null;
}) {
  const [pagina, setPagina] = useState(0);
  const total = Math.max(1, Math.ceil(items.length / PAGE_TEXTO));
  const actual = Math.min(pagina, total - 1);
  const visibles = items.slice(actual * PAGE_TEXTO, (actual + 1) * PAGE_TEXTO);

  const irA = (siguiente: number) =>
    setPagina(Math.max(0, Math.min(total - 1, siguiente)));

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-[#E4E1D8] bg-white">
        {cat && (
          <p className="border-b border-[#EEEBE3] px-gap-md py-[8px] font-lv-display text-[13px] font-semibold text-ink-soft/70">
            {cat}
          </p>
        )}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={actual}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            drag={total > 1 ? "x" : false}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.x < -50 || info.velocity.x < -400) irA(actual + 1);
              else if (info.offset.x > 50 || info.velocity.x > 400) irA(actual - 1);
            }}
            className="px-gap-md"
          >
            {visibles.map((item) => (
              <FilaTexto
                key={item.id ?? item.name}
                item={item}
                carrito={carrito}
                onAgregar={onAgregar}
                onQuitar={onQuitar}
                agotado={false}
                configTasa={configTasa}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <Paginador
        pagina={actual}
        total={total}
        onChange={irA}
        etiqueta={cat ?? "la carta"}
      />
    </div>
  );
}

function DestacadosScroll({ items }: { items: PlaceMenu[] }) {
  const destacados = items.filter((i) => i.destacado && i.image && !estaAgotado(i));
  if (destacados.length === 0) return null;

  return (
    <div className="mb-gap-md">
      <p className="mb-gap-xs font-lv-display text-meta font-semibold uppercase tracking-[0.08em] text-ink-soft/60">
        Destacados
      </p>
      <div className="flex gap-gap-sm overflow-x-auto pb-1 scrollbar-hide">
        {destacados.map((item) => (
          <div
            key={item.id ?? item.name}
            className="w-[140px] shrink-0 overflow-hidden rounded-[16px] border border-[#E4E1D8] bg-white"
          >
            <div className="relative h-[100px] w-full">
              <Image
                src={item.image!}
                alt={item.name}
                fill
                sizes="140px"
                className="object-cover"
                loading="lazy"
              />
            </div>
            <div className="p-[8px]">
              <p className="truncate font-lv-display text-[13px] font-bold text-[#1C2620]">
                {item.name}
              </p>
              <p className="font-lv-display text-[13px] font-bold text-verde-700">
                {formatPrecioItem(item)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Vista cuadrícula (tienda) ───────────────────────────────────────── */

function TarjetaCuadricula({
  item,
  existenciasModo,
  agotado,
  configTasa = null,
}: {
  item: PlaceMenu;
  existenciasModo: ExistenciasModo;
  agotado: boolean;
  configTasa?: ConfigTasa | null;
}) {
  const precio = formatPrecioItem(item);
  const stock = stockTexto(item, existenciasModo);
  const tieneFoto = Boolean(item.image);

  const stockColor = agotado
    ? "text-[#8A2F1F]"
    : stock?.startsWith("Quedan")
      ? "text-[#8A4B00]"
      : "text-[#1F5C2C]";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[16px] border border-[#E4E1D8] bg-white p-[8px]",
        agotado && "opacity-60",
      )}
    >
      {tieneFoto && (
        <div className="relative mb-[6px] aspect-square w-full overflow-hidden rounded-[10px]">
          <Image
            src={item.image!}
            alt={item.name}
            fill
            sizes="(min-width: 640px) 200px, 45vw"
            className="object-cover"
            loading="lazy"
          />
        </div>
      )}
      <p className="line-clamp-2 font-lv-display text-[13px] font-bold leading-snug text-[#1C2620]">
        {item.name}
      </p>
      <div className="mt-[4px] flex items-center justify-between gap-[4px]">
        {precio && (
          <span className="flex flex-col">
            <span className="font-lv-display text-[13px] font-[800] text-ink">
              {precio}
            </span>
            {(() => {
              const { secundario } = preciosDeItem(item, configTasa);
              return secundario ? (
                <span className="tabular-nums text-[11px] leading-none text-ink-soft/60">
                  {secundario}
                </span>
              ) : null;
            })()}
          </span>
        )}
        {existenciasModo !== "ninguna" && (
          <span className={cn("text-[11px] font-bold", stockColor)}>
            {agotado ? "Agotado" : (stock ?? "Disponible")}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Vista servicios ─────────────────────────────────────────────────── */

function FilaServicio({
  item,
  whatsappCita,
  agotado,
  configTasa = null,
}: {
  item: PlaceMenu;
  whatsappCita?: string;
  agotado: boolean;
  configTasa?: ConfigTasa | null;
}) {
  const precio = formatPrecioItem(item);
  const detalle = [
    item.duracionMin ? `${item.duracionMin} min` : null,
    precio || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const href = whatsappCita && !agotado ? hrefCitaItem(whatsappCita, item) : null;

  return (
    <div
      className={cn(
        "flex items-center gap-gap-sm border-b border-[#EEEBE3] py-[10px] last:border-b-0",
        agotado && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-lv-display text-[15px] font-bold text-[#1C2620]">
          {item.name}
        </p>
        {detalle && (
          <p className="text-[13px] text-[#5B6660]">{detalle}</p>
        )}
        {(() => {
          const { secundario } = preciosDeItem(item, configTasa);
          return secundario ? (
            <span className="tabular-nums text-[12px] leading-none text-ink-soft/60">
              {secundario}
            </span>
          ) : null;
        })()}
      </div>
      {agotado ? (
        <span className={cn(AGOTADO_LABEL, "shrink-0")}>Agotado</span>
      ) : href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 shrink-0 items-center gap-[5px] rounded-full border border-verde-500 px-gap-sm font-lv-display text-meta font-semibold text-verde-700 transition-colors hover:bg-verde-50 active:scale-95"
          aria-label={`Reservar ${item.name}`}
        >
          <MessageCircle size={14} strokeWidth={1.8} />
          Reservar
        </a>
      ) : null}
    </div>
  );
}

/* ── Especial del día (cafetería) ────────────────────────────────────── */

function EspecialBanner({ especial }: { especial: EspecialDelDia }) {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Havana" }).format(new Date());
  if (especial.hasta < hoy) return null;

  return (
    <div className="mb-gap-md rounded-2xl bg-verde-600 px-gap-md py-gap-sm text-white">
      <p className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em] text-verde-200">
        {COPY.especialDelDia}
      </p>
      <p className="font-lv-display text-[17px] font-bold">{especial.titulo}</p>
      {especial.descripcion && (
        <p className="text-[13px] text-verde-100">{especial.descripcion}</p>
      )}
      <p className="mt-[4px] font-lv-display text-[15px] font-bold">
        {especial.precio}
      </p>
    </div>
  );
}

/* ── Grupo de agotados (todos los tipos) ─────────────────────────────── */

const MAX_AGOTADOS_VISIBLE = 3;

function GrupoAgotados({
  items,
  vista,
  existenciasModo,
  whatsappCita,
  configTasa = null,
}: {
  items: PlaceMenu[];
  vista: Vista;
  existenciasModo: ExistenciasModo;
  whatsappCita?: string;
  configTasa?: ConfigTasa | null;
}) {
  const [pagina, setPagina] = useState(0);
  if (items.length === 0) return null;

  /* Misma constante que el bloque de disponibles para ser coherente. */
  const PAGE_SIZE_AGOT = vista === "cuadricula" ? 4 : 5;
  const totalPaginas = Math.max(1, Math.ceil(items.length / PAGE_SIZE_AGOT));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = items.slice(
    paginaActual * PAGE_SIZE_AGOT,
    (paginaActual + 1) * PAGE_SIZE_AGOT,
  );

  const irA = (sig: number) =>
    setPagina(Math.max(0, Math.min(totalPaginas - 1, sig)));

  function renderItems() {
    if (vista === "cuadricula") {
      return (
        <div className="grid grid-cols-2 gap-gap-sm">
          {visibles.map((item) => (
            <TarjetaCuadricula
              key={item.id ?? item.name}
              item={item}
              existenciasModo={existenciasModo}
              agotado
              configTasa={configTasa}
            />
          ))}
        </div>
      );
    }

    const contenido = visibles.map((item) =>
      vista === "servicios" ? (
        <FilaServicio key={item.id ?? item.name} item={item} whatsappCita={whatsappCita} agotado configTasa={configTasa} />
      ) : vista === "lista_foto" ? (
        <FilaConFoto key={item.id ?? item.name} item={item} agotado configTasa={configTasa} />
      ) : (
        <FilaTexto key={item.id ?? item.name} item={item} agotado configTasa={configTasa} />
      ),
    );

    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#E4E1D8] bg-white">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={paginaActual}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            drag={totalPaginas > 1 ? "x" : false}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.x < -50 || info.velocity.x < -400) irA(paginaActual + 1);
              else if (info.offset.x > 50 || info.velocity.x > 400) irA(paginaActual - 1);
            }}
            className="px-gap-md"
          >
            {contenido}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="mt-gap-lg">
      <p className="mb-gap-xs font-lv-display text-[13px] font-bold text-[#5B6660]">
        Agotado por hoy
        {items.length > 1 && (
          <span className="ml-[6px] font-normal text-ink-soft/50">
            ({items.length})
          </span>
        )}
      </p>

      {renderItems()}

      <Paginador
        pagina={paginaActual}
        total={totalPaginas}
        onChange={irA}
        etiqueta="agotados"
      />
    </div>
  );
}

/* ── Chips de categoría ──────────────────────────────────────────────── */

function ChipsCategorias({
  categorias,
  filtro,
  onChange,
}: {
  categorias: string[];
  filtro: string | null;
  onChange: (v: string | null) => void;
}) {
  if (categorias.length <= 1) return null;
  return (
    <div className="mb-gap-md flex gap-[6px] overflow-x-auto pb-1 scrollbar-hide">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={filtro === null}
        className={cn(CHIP, filtro === null ? CHIP_ON : CHIP_OFF)}
      >
        Todas
      </button>
      {categorias.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-pressed={filtro === c}
          className={cn(CHIP, filtro === c ? CHIP_ON : CHIP_OFF)}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

/* ── Componente principal ────────────────────────────────────────────── */

export function Catalogo({
  items,
  categorias: categoriasProp,
  titulo,
  existenciasModo,
  catalogoActualizadoEn,
  cartaHref,
  tipoNegocio,
  modulosActivos,
  especialDia,
  carrito,
  onAgregar,
  onQuitar,
  whatsappCita,
  configTasa = null,
  className,
}: {
  items: PlaceMenu[];
  categorias?: MenuCategoria[] | null;
  titulo: string;
  existenciasModo: ExistenciasModo;
  catalogoActualizadoEn?: number | null;
  cartaHref: string;
  tipoNegocio?: TipoNegocio | null;
  modulosActivos: ModuloFicha[];
  especialDia?: EspecialDelDia | null;
  carrito?: Record<string, number>;
  onAgregar?: (id: string) => void;
  onQuitar?: (id: string) => void;
  whatsappCita?: string;
  configTasa?: ConfigTasa | null;
  className?: string;
}) {
  const [filtro, setFiltro] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [paginaFoto, setPaginaFoto] = useState(0);
  const PAGE_FOTO = 5;

  const vista = determinarVista(tipoNegocio, modulosActivos);

  /* Categorías ordenadas */
  const estructuradas = ordenarCategorias(categoriasProp ?? []).map((c) => c.nombre);
  const autodetectadas: string[] = [];
  for (const item of items) {
    const c = item.category?.trim();
    if (c && !autodetectadas.includes(c)) autodetectadas.push(c);
  }
  const todasLasCategorias = [
    ...estructuradas,
    ...autodetectadas.filter((c) => !estructuradas.includes(c)),
  ].filter((nombre) => items.some((i) => i.category?.trim() === nombre));

  /* Separar disponibles y agotados.
     Se usa `disponibilidad === "agotado"` directamente, sin importar si
     `agotadoHasta` ya pasó. Un producto marcado como agotado sigue en el
     grupo de agotados hasta que el dueño lo marque como disponible.
     `agotadoHasta` solo controla el texto que se muestra («Vuelve mañana»). */
  const esAgotado = (i: PlaceMenu) => i.disponibilidad === "agotado";
  const disponibles = items.filter((i) => !esAgotado(i));
  const agotados = items.filter((i) => esAgotado(i));

  /* Filtrar disponibles por categoría y búsqueda */
  const filtradosDisp = disponibles.filter((i) => {
    if (filtro && i.category?.trim() !== filtro) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (
        i.name.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        false
      );
    }
    return true;
  });

  /* "Todo agotado" */
  const todoAgotado = disponibles.length === 0 && agotados.length > 0;

  /* Actualizado hace */
  const actualizadoHace = (() => {
    if (!catalogoActualizadoEn) return null;
    const mins = Math.floor((Date.now() - catalogoActualizadoEn) / 60_000);
    if (mins < 60) return `hace ${mins} min`;
    const hs = Math.floor(mins / 60);
    if (hs < 24) return `hace ${hs} h`;
    return `hace ${Math.floor(hs / 24)} d`;
  })();

  const conCarrito = Boolean(carrito && onAgregar && onQuitar);

  return (
    <section className={cn("min-w-0", className)}>
      {/* Cabecera */}
      <div className="mb-gap-md flex items-start justify-between gap-gap-xs">
        <div>
          <h2 className="font-lv-display text-h3 font-bold text-ink">{titulo}</h2>
          {/* Aviso visible de que hay agotados al fondo — evita que el usuario
              no los vea por no scrollear. */}
          {agotados.length > 0 && (
            <p className="mt-[3px] font-lv-display text-meta text-[#8A2F1F]">
              {agotados.length === 1
                ? "1 producto agotado por hoy"
                : `${agotados.length} productos agotados por hoy`}
            </p>
          )}
        </div>
        <Link href={cartaHref} className={cn(BTN_OUTLINE, "group shrink-0")}>
          {COPY.verCarta}
          <ArrowUpRight
            size={15}
            strokeWidth={1.8}
            className="transition-transform duration-300 group-hover:-translate-y-[2px] group-hover:translate-x-[2px]"
          />
        </Link>
      </div>

      {/* "Actualizado hace X" — tienda */}
      {vista === "cuadricula" && actualizadoHace && (
        <p className="mb-gap-sm text-[12px] text-[#5B6660]">
          Precios y existencias actualizados {actualizadoHace}
        </p>
      )}

      {/* Especial del día — cafetería */}
      {vista === "lista_texto" && especialDia && (
        <EspecialBanner especial={especialDia} />
      )}

      {/* Destacados — cafetería */}
      {vista === "lista_texto" && <DestacadosScroll items={items} />}

      {/* Buscador — tienda */}
      {vista === "cuadricula" && (
        <div className="relative mb-gap-md">
          <Search
            size={16}
            strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/50 pointer-events-none"
          />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar productos…"
            className="h-11 w-full rounded-xl border border-ink/10 bg-white pl-10 pr-4 font-lv text-small text-ink outline-none transition-colors focus:border-verde-400"
          />
        </div>
      )}

      {/* Chips de categoría */}
      <ChipsCategorias
        categorias={todasLasCategorias}
        filtro={filtro}
        onChange={(v) => { setFiltro(v); setPaginaFoto(0); }}
      />

      {/* Todo agotado */}
      {todoAgotado && (
        <div className="mb-gap-md rounded-xl border border-ink/5 bg-sand-warm px-gap-md py-gap-sm">
          <p className="text-[13px] text-[#5B6660]">
            Hoy no queda nada disponible. Vuelve a consultar más tarde.
          </p>
        </div>
      )}

      {/* ─── Contenido por vista ───────────────────────────────────────── */}

      {vista === "lista_foto" && (() => {
        const totalPaginas = Math.max(1, Math.ceil(filtradosDisp.length / PAGE_FOTO));
        const paginaActual = Math.min(paginaFoto, totalPaginas - 1);
        const visiblesFoto = filtradosDisp.slice(
          paginaActual * PAGE_FOTO,
          (paginaActual + 1) * PAGE_FOTO,
        );
        const irA = (siguiente: number) =>
          setPaginaFoto(Math.max(0, Math.min(totalPaginas - 1, siguiente)));

        return (
          <>
            <div className="relative overflow-hidden rounded-2xl border border-[#E4E1D8] bg-white">
              <AnimatePresence initial={false} mode="popLayout" custom={paginaActual}>
                <motion.div
                  key={paginaActual}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  drag={totalPaginas > 1 ? "x" : false}
                  dragDirectionLock
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.1}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -50 || info.velocity.x < -400)
                      irA(paginaActual + 1);
                    else if (info.offset.x > 50 || info.velocity.x > 400)
                      irA(paginaActual - 1);
                  }}
                  className="px-gap-md"
                >
                  {filtradosDisp.length === 0 && !todoAgotado && (
                    <p className="py-gap-md text-[13px] text-ink-soft/60">
                      No hay productos en esta categoría.
                    </p>
                  )}
                  {visiblesFoto.map((item) => (
                    <FilaConFoto
                      key={item.id ?? item.name}
                      item={item}
                      carrito={conCarrito ? carrito : undefined}
                      onAgregar={conCarrito ? onAgregar : undefined}
                      onQuitar={conCarrito ? onQuitar : undefined}
                      agotado={false}
                      configTasa={configTasa}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            <Paginador
              pagina={paginaActual}
              total={totalPaginas}
              onChange={irA}
              etiqueta="la carta"
            />
          </>
        );
      })()}

      {vista === "lista_texto" && (() => {
        /* Agrupa por categoría manteniendo el orden de todasLasCategorias.
           Los sin categoría van en un grupo al final. */
        const sinFiltroDeCategoria = filtradosDisp;
        const gruposOrdenados: Array<{ cat: string | null; items: PlaceMenu[] }> =
          todasLasCategorias.length > 1
            ? todasLasCategorias
                .map((cat) => ({
                  cat: cat as string | null,
                  items: sinFiltroDeCategoria.filter(
                    (i) => i.category?.trim() === cat,
                  ),
                }))
                .filter((g) => g.items.length > 0)
            : [{ cat: null, items: sinFiltroDeCategoria }];

        const sinCat = sinFiltroDeCategoria.filter((i) => !i.category?.trim());
        if (sinCat.length > 0 && todasLasCategorias.length > 1) {
          gruposOrdenados.push({ cat: null, items: sinCat });
        }

        return (
          <div className="flex flex-col gap-gap-md">
            {gruposOrdenados.map((grupo) => (
              <GrupoTexto
                key={grupo.cat ?? "__sin__"}
                cat={grupo.cat}
                items={grupo.items}
                carrito={conCarrito ? carrito : undefined}
                onAgregar={conCarrito ? onAgregar : undefined}
                onQuitar={conCarrito ? onQuitar : undefined}
                configTasa={configTasa}
              />
            ))}
          </div>
        );
      })()}

      {vista === "cuadricula" && (
        <div className="grid grid-cols-2 gap-[10px]">
          {filtradosDisp.map((item) => (
            <TarjetaCuadricula
              key={item.id ?? item.name}
              item={item}
              existenciasModo={existenciasModo}
              agotado={false}
              configTasa={configTasa}
            />
          ))}
          {filtradosDisp.length === 0 && !todoAgotado && (
            <p className="col-span-2 py-gap-md text-[13px] text-ink-soft/60">
              Sin resultados para «{busqueda}».
            </p>
          )}
        </div>
      )}

      {vista === "servicios" && (
        <div className="overflow-hidden rounded-2xl border border-[#E4E1D8] bg-white px-gap-md">
          {filtradosDisp.map((item) => (
            <FilaServicio
              key={item.id ?? item.name}
              item={item}
              whatsappCita={whatsappCita}
              agotado={false}
              configTasa={configTasa}
            />
          ))}
        </div>
      )}

      {/* Grupo de agotados — siempre al final */}
      <GrupoAgotados
        items={agotados}
        vista={vista}
        existenciasModo={existenciasModo}
        whatsappCita={whatsappCita}
        configTasa={configTasa}
      />

      {/* "Actualizado hace X" — no tienda (tienda lo muestra arriba) */}
      {vista !== "cuadricula" && actualizadoHace && (
        <p className="mt-gap-sm text-right font-lv-display text-meta text-ink-soft/50">
          {COPY.actualizadoHace} {actualizadoHace}
        </p>
      )}
    </section>
  );
}
