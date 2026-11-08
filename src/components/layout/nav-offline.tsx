"use client";

import { useEffect } from "react";
import { sinRed, setSinRed } from "@/lib/offline/estado-red";

/**
 * Interceptor global de navegación sin red.
 *
 * Monta un listener de captura en el documento. Cuando el estado de red es
 * «sin conexión» (según `estado-red.ts`, que combina `navigator.onLine` y
 * fallos reales de la cola), convierte los clics en enlaces internos de SPA
 * en navegaciones completas con `window.location.assign`.
 *
 * Por qué es necesario: Next.js App Router intercepta los clics en `<Link>`
 * antes de que lleguen al DOM y los convierte en peticiones RSC. Sin red esas
 * peticiones fallan. Con `window.location.assign` el navegador hace una
 * petición de navegación real que el service worker puede interceptar y servir
 * desde caché o desde la página offline correspondiente.
 *
 * Condiciones para interceptar:
 *  - Estado de red: sinRed() === true o navigator.onLine === false.
 *  - Enlace del mismo origen (href absoluto o relativo, no externo).
 *  - Sin `target` ni teclas modificadoras (Ctrl, Cmd, Shift, Alt).
 *  - No es un enlace de descarga.
 */
export function NavOffline() {
  useEffect(() => {
    // Sincroniza el estado inicial con navigator.onLine.
    // EstadoConexion también lo hace, pero puede montarse después que NavOffline.
    if (!navigator.onLine) setSinRed(true);

    function handleClick(event: MouseEvent) {
      // Sin red = sinRed() O navigator.onLine falso.
      if (!sinRed() && navigator.onLine) return;

      // Solo clics primarios sin modificadores.
      if (event.button !== 0) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (event.defaultPrevented) return;

      // Busca el <a> más cercano al target.
      const a = (event.target as Element | null)?.closest("a");
      if (!a) return;

      // Sin href, con target distinto de _self, o enlace de descarga: no interceptar.
      const href = a.getAttribute("href");
      if (!href) return;
      if (a.hasAttribute("download")) return;
      const target = a.getAttribute("target");
      if (target && target !== "_self") return;

      // Solo el mismo origen.
      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      // Interceptar: fuerza navegación completa para que el SW pueda actuar.
      event.preventDefault();
      window.location.assign(url.href);
    }

    // Captura antes de que Next.js procese el clic.
    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, []);

  return null;
}
