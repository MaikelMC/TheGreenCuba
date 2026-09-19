"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MapPin, Settings, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { MobileDock } from "@/components/layout/mobile-dock";

export type ProfileView = "perfil" | "lugares" | "ajustes";

interface DockItem {
  id: ProfileView;
  label: string;
  icon: LucideIcon;
}

/* Tres destinos y ni uno más: un dock se recorre de un vistazo, y en cuanto
   pasa de cinco iconos deja de ser un dock y pasa a ser un menú. */
export const DOCK_ITEMS: DockItem[] = [
  { id: "perfil", label: "Perfil", icon: UserRound },
  { id: "lugares", label: "Mis lugares", icon: MapPin },
  { id: "ajustes", label: "Configuración", icon: Settings },
];

const GLASS =
  "border border-ink/5 bg-white/70 backdrop-blur-[20px] shadow-card";

/**
 * El dock del perfil. Dos piezas distintas, no una que se encoge.
 *
 * En escritorio es un dock de verdad: flota centrado abajo y **magnifica** al
 * pasar el ratón —el icono señalado crece y los vecinos crecen menos cuanto más
 * lejos están—, con el nombre del señalado encima y un punto bajo el activo.
 * Esa respuesta a la distancia es lo que lo separa de una barra de pestañas.
 *
 * En móvil no hay ratón, así que magnificar no significa nada y solo dejaría
 * los iconos descolocados al tocar. Esa mitad la resuelve `MobileDock`, la
 * pastilla plana que comparten el perfil, el panel de negocio y administración.
 */
export function ProfileDock({
  view,
  onChange,
}: {
  view: ProfileView;
  onChange: (view: ProfileView) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <>
      {/* Escritorio */}
      <nav
        aria-label="Secciones del perfil"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 hidden justify-center lg:flex"
      >
        <div
          onMouseLeave={() => setHovered(null)}
          className={cn(GLASS, "pointer-events-auto flex items-end gap-1 rounded-4xl p-2")}
        >
          {DOCK_ITEMS.map(({ id, label, icon: Icon }, i) => {
            const active = view === id;
            const scale = hovered === null ? 1 : 1 + 0.22 / (1 + Math.abs(i - hovered));

            return (
              <div key={id} className="relative">
                <AnimatePresence>
                  {hovered === i && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 font-lv-display text-[11px] font-medium text-white"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* `transformOrigin: bottom` con los botones apoyados abajo: el
                    icono crece hacia arriba, no hacia el centro, que es lo que
                    hace el dock del sistema. */}
                <motion.button
                  type="button"
                  onMouseEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                  onClick={() => onChange(id)}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  animate={{ scale }}
                  transition={spring}
                  style={{ transformOrigin: "bottom" }}
                  className={cn(
                    "grid size-12 cursor-pointer place-items-center rounded-2xl transition-colors duration-500 ease-outquint",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
                    active
                      ? "bg-verde-50 text-verde-600"
                      : "text-ink-soft/75 hover:bg-sand hover:text-ink",
                  )}
                >
                  <Icon size={22} strokeWidth={1.8} />
                </motion.button>

                {/* El punto de «abierto» del dock, debajo y no al lado. */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute -bottom-[2px] left-1/2 size-1 -translate-x-1/2 rounded-full bg-verde-400"
                  />
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Móvil. La misma pastilla que usan los paneles: una sola definición del
          dock de móvil para los tres armazones. */}
      <MobileDock
        label="Secciones del perfil"
        items={DOCK_ITEMS.map(({ id, label, icon }) => ({
          key: id,
          label,
          icon,
          onSelect: () => onChange(id),
          active: view === id,
        }))}
      />
    </>
  );
}
