"use client";

import { useEffect, useRef } from "react";
import { trackEvento, trackEventos } from "@/lib/eventos-client";
import type { TipoEvento } from "@/lib/eventos";

/**
 * La carta, contada.
 *
 * `/m/{slug}` se resuelve entero en el servidor y **no manda JavaScript de
 * más** —lo dice su propio archivo—. Esto es la única isla de cliente que se
 * añade, y no pinta nada: se limita a mirar la carta ya servida.
 *
 * Tres gestos, y en este orden de importancia por lo que cuestan:
 *
 * 1. **`vista_menu`**, al montar. Un beacon.
 * 2. Los clics en «Llamar» y «WhatsApp»: escucha **delegada** en el documento,
 *    así que no hay un `onClick` por enlace ni un componente de cliente por
 *    botón. El servidor solo marca los enlaces con `data-evento`.
 * 3. **`producto_visto`**, con `IntersectionObserver` sobre las filas marcadas
 *    con `data-producto`. Se **acumulan** y se mandan juntos al salir: uno por
 *    producto sería media docena de viajes por visita, y la carta la abre gente
 *    con datos contados.
 *
 * Si un navegador viejo no trae `IntersectionObserver`, se queda sin contarlos:
 * es una cifra del panel, no algo que deba romper la carta.
 */
export function EventosMenu({ negocioId }: { negocioId: string }) {
  /* Los nombres ya contados en esta visita. Al salir van todos en un beacon. */
  const vistos = useRef(new Set<string>());

  useEffect(() => {
    trackEvento({ tipo: "vista_menu", negocioId });

    const observador =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entradas) => {
              for (const entrada of entradas) {
                if (!entrada.isIntersecting) continue;
                const nombre = (entrada.target as HTMLElement).dataset.producto;
                if (nombre) vistos.current.add(nombre);
                /* Visto una vez es visto: no hace falta seguir mirándolo. */
                observador?.unobserve(entrada.target);
              }
            },
            { rootMargin: "0px 0px -20% 0px" },
          );

    if (observador) {
      document
        .querySelectorAll<HTMLElement>("[data-producto]")
        .forEach((nodo) => observador.observe(nodo));
    }

    const alClic = (evento: MouseEvent) => {
      const objetivo = (evento.target as HTMLElement | null)?.closest?.(
        "[data-evento]",
      ) as HTMLElement | null;
      const tipo = objetivo?.dataset.evento;
      if (tipo === "click_llamar" || tipo === "click_whatsapp") {
        trackEvento({ tipo: tipo as TipoEvento, negocioId });
      }
    };
    document.addEventListener("click", alClic);

    const alSalir = () => {
      const productos = [...vistos.current];
      if (productos.length === 0) return;
      trackEventos(
        productos.map((nombre) => ({
          tipo: "producto_visto" as const,
          negocioId,
          dimension: nombre,
        })),
      );
      /* Vaciar hace que esto sea idempotente: si el navegador dispara `pagehide`
         y además se desmonta, el segundo intento no manda nada. */
      vistos.current.clear();
    };
    window.addEventListener("pagehide", alSalir);

    return () => {
      observador?.disconnect();
      document.removeEventListener("click", alClic);
      window.removeEventListener("pagehide", alSalir);
      /* Navegación interna de la SPA: no hay `pagehide`, pero el componente se
         desmonta y es la última ocasión de contar lo visto. */
      alSalir();
    };
  }, [negocioId]);

  return null;
}
