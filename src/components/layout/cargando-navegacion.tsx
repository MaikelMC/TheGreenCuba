"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { Spinner } from "@/components/ui";

/** Por debajo de esto la navegación se nota instantánea y no se avisa. */
const RETARDO_MS = 250;
/* ponytail: tope fijo por si un clic en un <a> no llegó a navegar (su propio
   onClick lo canceló). Si alguna pantalla tarda de verdad más, subirlo. */
const TOPE_MS = 20_000;

/**
 * Aviso de «cargando» entre páginas: el logo pequeño en el centro con un aro
 * girando.
 *
 * El App Router no da ninguna señal al empezar una navegación, y con datos
 * lentos la pantalla se quedaba congelada en la página anterior hasta que
 * llegaba la nueva. Aquí se escucha el clic en cualquier enlace interno (y el
 * botón atrás) y se da por terminada cuando cambia la URL que ve React.
 *
 * Es `pointer-events-none`: si el usuario se arrepiente puede tocar otro
 * enlace sin esperar. No cubre `router.push` lanzado desde código.
 */
export function CargandoNavegacion() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);
  const actual = useRef("");

  function parar() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setVisible(false);
  }

  // La ruta nueva ya está pintada: fin de la carga.
  useEffect(() => {
    actual.current = `${pathname}?${search.toString()}`;
    parar();
  }, [pathname, search]);

  useEffect(() => {
    function empezar() {
      parar();
      timers.current = [
        window.setTimeout(() => setVisible(true), RETARDO_MS),
        window.setTimeout(() => setVisible(false), TOPE_MS),
      ];
    }

    const claveDe = (url: URL) =>
      `${url.pathname}?${url.searchParams.toString()}`;

    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest("a");
      const href = a?.getAttribute("href");
      if (!a || !href || a.hasAttribute("download")) return;
      const target = a.getAttribute("target");
      if (target && target !== "_self") return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Mismo sitio con otro #ancla: no hay nada que cargar.
      if (claveDe(url) === actual.current) return;
      empezar();
    }

    function onPopState() {
      if (claveDe(new URL(window.location.href)) !== actual.current) empezar();
    }

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onPopState);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-300 grid place-items-center bg-ink/10 animate-fade-in">
      <div className="relative grid size-16 place-items-center rounded-full bg-white shadow-card">
        <Spinner className="absolute -inset-1 size-auto border-[3px]" />
        <Logo className="h-8 w-auto animate-pulse-ring motion-reduce:animate-none" />
      </div>
    </div>
  );
}
