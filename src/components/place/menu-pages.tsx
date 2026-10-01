"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MenuItem } from "./menu-item";

/**
 * Cuántas entradas de «Lo que ofrece» caben en una página. Cuatro: dos filas de
 * dos en la rejilla de escritorio y cuatro filas en la columna del móvil, que
 * es lo que se ve antes de que la sección empiece a comerse la pantalla.
 */
const PAGE_SIZE = 4;

/* La forma de una entrada, sacada del propio `MenuItem` en vez de repetida: si
   mañana el ítem gana un campo, esto lo gana solo. */
type MenuEntry = Omit<
  React.ComponentProps<typeof MenuItem>,
  "index" | "className"
>;

/* El deslizamiento. `custom` lleva la dirección —1 avanza, -1 retrocede— porque
   el que sale tiene que hacerlo hacia el lado contrario que el que entra, y para
   cuando `AnimatePresence` lo pinta ya no queda estado suyo que consultar. */
const SLIDE = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

const PAGE_BTN =
  "grid place-items-center size-9 rounded-full border border-ink/10 bg-white text-ink cursor-pointer transition-all duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600 disabled:opacity-35 disabled:pointer-events-none";

interface MenuPagesProps {
  items: MenuEntry[];
  /** `grid` es la rejilla de dos columnas de escritorio; `list`, la columna del móvil. */
  variant: "grid" | "list";
}

export function MenuPages({ items, variant }: MenuPagesProps) {
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(1);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  /* Si el negocio quita entradas y la página actual se queda sin sitio, se lee
     la última en vez de dejar la lista vacía. */
  const current = Math.min(page, pageCount - 1);
  const visible = items.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE,
  );

  function go(delta: number) {
    const next = current + delta;
    if (next < 0 || next >= pageCount) return;
    setDirection(delta);
    setPage(next);
  }

  /* En el móvil se pasa de página arrastrando; el botón de anteriores y
     siguientes es solo de escritorio, donde no hay gesto que valga. */
  const canSwipe = pageCount > 1;

  return (
    <>
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={SLIDE}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            drag={canSwipe ? "x" : false}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 || info.velocity.x < -500) go(1);
              else if (info.offset.x > 60 || info.velocity.x > 500) go(-1);
            }}
            className={cn(
              variant === "grid"
                ? "grid grid-cols-2 gap-x-gap-lg"
                : "flex flex-col gap-gap-sm",
            )}
          >
            {visible.map((item, i) => (
              <MenuItem key={i} index={i} {...item} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {variant === "grid" && pageCount > 1 && (
        <div className="flex items-center justify-end gap-gap-xs mt-gap-md">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={current === 0}
            aria-label="Página anterior de lo que ofrece"
            className={PAGE_BTN}
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={current === pageCount - 1}
            aria-label="Página siguiente de lo que ofrece"
            className={PAGE_BTN}
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>
      )}
    </>
  );
}
