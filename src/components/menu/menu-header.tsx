"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Menu as MenuIcon, Search, X } from "lucide-react";
import type { PlaceStatus } from "@/types";
import { cn } from "@/lib/utils";

/**
 * La barra de la carta: buscador y categorías, dentro de la sección del menú.
 *
 * Sin scroll enseña el buscador visible y los chips, como la barra de siempre.
 * Cuando el scroll la deja pegada arriba, el campo se recoge en la lupa y
 * aparecen el logo, el estado y el nombre del negocio más el menú de acciones.
 *
 * El alto real se publica en `--menu-header-h` con un `ResizeObserver`: el
 * `scroll-margin-top` de cada grupo se calcula desde ahí, así que los saltos de
 * ancla esquivan la barra aunque cambie de alto.
 */
const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const CHIP =
  "inline-flex h-[var(--carta-chip-alto)] shrink-0 items-center whitespace-nowrap rounded-full border border-ink/10 bg-white px-3 font-lv-display text-meta font-medium text-ink-soft/75 cursor-pointer transition-colors duration-500 ease-outquint hover:border-verde-300 hover:bg-verde-50 hover:text-verde-600";

const ICON_BTN =
  "grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors duration-500 ease-outquint hover:bg-sand-deep";

const DROPDOWN_ITEM =
  "flex w-full items-center gap-gap-sm px-gap-md py-[10px] font-lv-display text-small font-medium text-ink transition-colors duration-500 ease-outquint hover:bg-verde-50";

export interface MenuHeaderGrupo {
  name: string;
  id: string;
}

interface MenuHeaderProps {
  negocio: {
    name: string;
    status: PlaceStatus;
    brand: string | null;
    emoji: string;
  };
  /** `null` cuando la ficha no debe ofrecerse (el negocio de prueba). */
  fichaHref: string | null;
  /** Página pública del negocio, absoluta, para abrir en otra pestaña. */
  laVerdeHref: string;
  groups: MenuHeaderGrupo[];
}

export function MenuHeader({
  negocio,
  fichaHref,
  laVerdeHref,
  groups,
}: MenuHeaderProps) {
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [pegado, setPegado] = useState(false);

  const centinelaRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);
  const chipsRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const abierto = negocio.status === "active";
  /* Arriba, el campo es siempre visible; pegado, solo si se abrió con la lupa
     o si hay un término que filtra la carta. */
  const campoVisible = !pegado || buscando || busqueda.trim() !== "";

  /* El vigía de encima: cuando sale por arriba, la barra está pegada. Si queda
     por debajo del pliegue no cuenta: todavía no se ha fijado. */
  useEffect(() => {
    const el = centinelaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      setPegado(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Al soltarse la barra, el menú vuelve a su sitio: si quedaba abierto, el
     desplegable viajaría dentro de la fila que se recoge. */
  useEffect(() => {
    if (!pegado) setMenuAbierto(false);
  }, [pegado]);

  /* El alto real, publicado para los `scroll-mt` de las secciones. */
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const aplicar = () =>
      document.documentElement.style.setProperty(
        "--menu-header-h",
        `${el.offsetHeight}px`,
      );
    aplicar();
    const observer = new ResizeObserver(aplicar);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* El foco va al campo al abrirlo con la lupa. */
  useEffect(() => {
    if (buscando) campoRef.current?.focus();
  }, [buscando]);

  /* Filtra sobre lo ya pintado: ni una petición, el HTML servido sigue
     mandando. */
  useEffect(() => {
    const raiz = document.querySelector<HTMLElement>("[data-carta]");
    if (!raiz) return;

    const termino = normalizar(busqueda.trim());
    let visibles = 0;

    for (const tarjeta of raiz.querySelectorAll<HTMLElement>("[data-buscar]")) {
      const texto = tarjeta.dataset.buscar ?? "";
      const coincide = !termino || normalizar(texto).includes(termino);
      tarjeta.style.display = coincide ? "" : "none";
      if (coincide) visibles++;
    }

    for (const grupo of raiz.querySelectorAll<HTMLElement>("[data-grupo]")) {
      const tieneAlgo = Array.from(
        grupo.querySelectorAll<HTMLElement>("[data-buscar]"),
      ).some((tarjeta) => tarjeta.style.display !== "none");
      grupo.style.display = tieneAlgo ? "" : "none";
    }

    /* Los chips llevan a grupos que la búsqueda puede haber escondido; mientras
       se busca, no llevan a ninguna parte. */
    if (chipsRef.current)
      chipsRef.current.style.display = termino ? "none" : "";

    const vacio = raiz.querySelector<HTMLElement>("[data-sin-resultados]");
    if (vacio) vacio.hidden = !termino || visibles > 0;
  }, [busqueda]);

  /* Cerrar el desplegable al tocar fuera o con Escape. */
  useEffect(() => {
    if (!menuAbierto) return;
    function fuera(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAbierto(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuAbierto(false);
    }
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [menuAbierto]);

  return (
    <>
      <div ref={centinelaRef} aria-hidden className="h-px" />
      {/* `safe-top`: la carta se abre suelta en el navegador y como PWA; con
          `viewportFit: cover` este es su único encabezado y sin el relleno
          quedaba bajo la hora del iPhone. */}
      <header
        ref={headerRef}
        className="safe-top sticky top-0 z-50 -mx-gutter border-b border-ink/5 bg-white/90 px-gutter py-gap-xs shadow-soft backdrop-blur-md"
      >
        {/* Solo con la barra pegada: el negocio y las acciones. Arriba no
            hacen falta —la ficha completa está justo encima— y robaban sitio
            al buscador. */}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-500 ease-outquint",
            pegado
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] overflow-hidden opacity-0",
          )}
          inert={!pegado}
        >
          <div className="flex min-h-0 items-center gap-gap-sm">
            {negocio.brand ? (
              <span className="relative block size-12 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-white">
                <Image
                  src={negocio.brand}
                  alt=""
                  fill
                  sizes="48px"
                  quality={70}
                  className="object-cover"
                />
              </span>
            ) : (
              <span
                aria-hidden
                className="grid size-12 shrink-0 place-items-center rounded-full bg-sand-deep text-[22px]"
              >
                {negocio.emoji}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "font-lv-display text-[10px] font-semibold uppercase tracking-[0.14em]",
                  abierto ? "text-verde-600" : "text-destructive",
                )}
              >
                {abierto ? "Abierto" : "Cerrado"}
              </p>
              <p className="truncate font-lv-display text-[20px] font-bold leading-tight text-ink">
                {negocio.name}
              </p>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-[2px]">
              <button
                type="button"
                onClick={() => {
                  if (campoVisible) {
                    setBusqueda("");
                    setBuscando(false);
                  } else {
                    setBuscando(true);
                  }
                }}
                aria-label={
                  campoVisible
                    ? "Cerrar el buscador"
                    : "Buscar productos en el menú"
                }
                aria-expanded={campoVisible}
                aria-controls="buscador-menu"
                className={ICON_BTN}
              >
                {campoVisible ? (
                  <X size={20} strokeWidth={1.8} />
                ) : (
                  <Search size={20} strokeWidth={1.8} />
                )}
              </button>

              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuAbierto((v) => !v)}
                  aria-label="Abrir menú del negocio"
                  aria-haspopup="menu"
                  aria-expanded={menuAbierto}
                  aria-controls="menu-header-dropdown"
                  className={ICON_BTN}
                >
                  <MenuIcon size={22} strokeWidth={1.8} />
                </button>

                {menuAbierto && (
                  <div
                    id="menu-header-dropdown"
                    role="menu"
                    className="absolute right-0 top-[calc(100%+8px)] z-20 w-[224px] overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-card"
                  >
                    {fichaHref && (
                      <Link
                        href={fichaHref}
                        role="menuitem"
                        onClick={() => setMenuAbierto(false)}
                        className={DROPDOWN_ITEM}
                      >
                        <ArrowUpRight
                          size={15}
                          strokeWidth={2}
                          className="shrink-0"
                        />
                        Ver ficha
                      </Link>
                    )}
                    <a
                      href={laVerdeHref}
                      target="_blank"
                      rel="noopener"
                      role="menuitem"
                      onClick={() => setMenuAbierto(false)}
                      className={cn(
                        DROPDOWN_ITEM,
                        fichaHref && "border-t border-ink/5",
                      )}
                    >
                      <ArrowUpRight
                        size={15}
                        strokeWidth={2}
                        className="shrink-0"
                      />
                      Visitar en La Verde
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* El buscador. Arriba, siempre visible sobre los filtros, como antes;
            pegado, solo cuando se abre con la lupa. */}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-500 ease-outquint",
            campoVisible
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] overflow-hidden opacity-0",
          )}
          inert={!campoVisible}
        >
          <div
            id="buscador-menu"
            className={cn("relative min-h-0", pegado && "pt-gap-xs")}
          >
            <Search
              size={16}
              strokeWidth={1.8}
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft/50"
            />
            <input
              ref={campoRef}
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar productos…"
              aria-label="Buscar productos en el menú"
              autoComplete="off"
              enterKeyHint="search"
              className="h-[var(--carta-buscador-alto)] w-full appearance-none rounded-full border border-ink/10 bg-white pl-10 pr-12 font-lv-display text-body text-ink outline-none transition-colors duration-500 ease-outquint placeholder:text-ink-soft/60 focus:border-verde-400 focus-visible:ring-2 focus-visible:ring-verde-400/40 sm:text-small [&::-webkit-search-cancel-button]:appearance-none"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda("");
                  campoRef.current?.focus();
                }}
                aria-label="Borrar la búsqueda"
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-soft/60 transition-colors duration-500 ease-outquint hover:bg-sand-deep hover:text-ink"
              >
                <X size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* La navegación de categorías de siempre. Solo hay chip para lo que
            tiene nombre y hay al menos dos. */}
        {groups.length > 1 && (
          <nav
            ref={chipsRef}
            aria-label="Categorías del menú"
            className="mt-[6px]"
          >
            <div className="carta-filtros-scroll scrollbar-hide flex items-center gap-[6px] overflow-x-auto">
              {groups.map((group) => (
                <a key={group.name} href={`#${group.id}`} className={CHIP}>
                  {group.name}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
