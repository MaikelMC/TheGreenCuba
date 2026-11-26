"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { UserMenu } from "@/components/layout/user-menu";

/**
 * La barra del home.
 *
 * Es una variante local, no la cabecera global: el resto de páginas conserva
 * su barra con sugerencias y flecha. Aquí el buscador es una puerta a la
 * pantalla de búsqueda con IA, y el avatar va sin flecha porque el menú se
 * abre tocándolo, no desplegando una lista de sugerencias.
 */
export function HomeTopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  return (
    <header className="map-navigation safe-top fixed inset-x-0 top-0 z-200 flex h-header items-center gap-2 border-b border-ink/5 bg-sand-warm/90 px-3 font-lv text-ink backdrop-blur-[16px] sm:gap-gap-sm sm:px-gap-md">
      <Link
        href="/home"
        aria-label="La Verde, ir al inicio"
        className="-m-[9px] flex min-w-11 shrink-0 items-center p-[9px]"
      >
        <Logo className="h-[26px] w-auto shrink-0" />
        <span className="font-lv-display text-[19px] font-bold tracking-[-0.02em] text-ink max-sm:hidden">
          La Verde
        </span>
      </Link>

      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Buscar con IA"
        aria-haspopup="dialog"
        className="home-search-form flex min-h-11 min-w-0 flex-1 cursor-text items-center gap-2 rounded-full border border-ink/10 bg-white py-1 pl-4 pr-1 text-left transition-colors duration-500 ease-outquint hover:border-verde-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-400 sm:pl-[14px]"
      >
        <span className="min-w-0 flex-1 truncate font-lv text-[15px] text-ink-soft/75">
          Pregúntale a la IA…
        </span>
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-verde-400 text-verde-950"
        >
          <Search size={17} strokeWidth={2.2} />
        </span>
      </button>

      <UserMenu compact />
    </header>
  );
}
