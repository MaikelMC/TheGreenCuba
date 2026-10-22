"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";

/**
 * El buscador de productos de la carta pública.
 *
 * Filtra **sobre lo que ya está pintado**: las tarjetas las sigue sirviendo el
 * servidor y aquí solo se oculta lo que no coincide. Así buscar no cuesta ni una
 * petición ni un byte de datos —la carta la abre gente con datos contados— y el
 * HTML sigue siendo la fuente de verdad.
 *
 * La comparación ignora tildes y mayúsculas: quien escribe «cafe» encuentra
 * «Café» desde el teclado del teléfono, que no siempre tiene la tilde a mano.
 *
 * Los grupos y los chips de categoría también se ocultan cuando la búsqueda los
 * deja vacíos; al borrar el término vuelve todo tal cual.
 */
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function BuscadorMenu({ children }: { children?: ReactNode }) {
  const [busqueda, setBusqueda] = useState("");
  const chipsRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raiz = document.querySelector<HTMLElement>("[data-carta]");
    if (!raiz) return;

    const termino = normalizar(busqueda.trim());
    let visibles = 0;

    /* `data-buscar` y no `data-producto`: el segundo lo usa la isla de eventos
       para contar productos vistos, y una tarjeta de oferta también es un
       producto buscable aunque no deba sumar una visita por estar arriba. */
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
       se busca, el gesto no lleva a ninguna parte, así que no se enseñan. */
    if (chipsRef.current) chipsRef.current.style.display = termino ? "none" : "";

    const vacio = raiz.querySelector<HTMLElement>("[data-sin-resultados]");
    if (vacio) vacio.hidden = !termino || visibles > 0;
  }, [busqueda]);

  return (
    <div className="carta-filtros sticky top-0 z-20 mb-gap-sm flex flex-col gap-[6px] bg-background">
      <div className="relative">
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
          /* El «borrar» nativo de `type="search"` cambia de forma en cada
             navegador y desaparece con `appearance-none`; el botón de al lado
             es el mismo en todos. 16 px en el teléfono: menos y iOS hace zoom
             al enfocar el campo. */
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
      {children ? (
        <div ref={chipsRef}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
