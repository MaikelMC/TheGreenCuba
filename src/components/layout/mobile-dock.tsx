"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileDockItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Con `href` sale un enlace; sin él, un botón que avisa por `onSelect`. */
  href?: string;
  onSelect?: () => void;
  active?: boolean;
}

/**
 * El dock, en su versión de móvil, compartido por los tres armazones: el
 * perfil, el panel de negocio y el de administración.
 *
 * En móvil no hay ratón, así que la magnificación del dock de escritorio no
 * significa nada y solo dejaría los iconos descolocados al tocar. Queda la otra
 * mitad del dock —flotar, agrupar, estar al alcance del pulgar— en una pastilla
 * plana donde el activo se marca con fondo en vez de con cercanía.
 *
 * Antes esto era una barra pegada al borde inferior con filete verde. La
 * pastilla flota 12 px sobre el borde y deja ver el contenido por debajo, que
 * es lo que la separa de una barra de pestañas. El contenido tiene que llevar
 * abajo el hueco `pb-dock-clear`: los 4 rem de la barra vieja ya no son la
 * medida, y sin el hueco el último elemento queda debajo.
 */
export function MobileDock({
  items,
  label,
  className,
}: {
  items: MobileDockItem[];
  label: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn("fixed inset-x-3 bottom-dock-bottom z-50 lg:hidden", className)}
    >
      <div className="flex items-center gap-1 rounded-full border border-ink/5 bg-white/70 p-1.5 shadow-card backdrop-blur-[20px]">
        {items.map(({ key, label: text, icon: Icon, href, onSelect, active }) => {
          const itemClass = cn(
            "flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-[2px] rounded-full py-2",
            "font-lv-display text-[10px] font-medium transition-colors duration-500 ease-outquint",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400/40",
            active ? "bg-verde-50 text-verde-700" : "text-ink-soft/75",
          );
          const content = (
            <>
              <Icon size={20} strokeWidth={1.8} />
              <span className="max-w-full truncate">{text}</span>
            </>
          );

          return href ? (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={itemClass}
            >
              {content}
            </Link>
          ) : (
            <button
              key={key}
              type="button"
              onClick={onSelect}
              aria-current={active ? "page" : undefined}
              className={itemClass}
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
