"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initAnalytics, trackPageView } from "@/lib/analytics";

/**
 * Punto de montaje de PostHog en el layout raíz.
 *
 * No envuelve a los hijos ni aporta contexto: solo inicializa el SDK una vez
 * y emite el `$pageview` en cada cambio de ruta. Sin key en el entorno, todo
 * queda en no-op y este componente no cuesta nada.
 *
 * Va junto a `InactivityGuard`: un compañero silencioso del árbol, no un
 * provider del que otros componentes dependan — cada punto del sitio que
 * quiera mandar un evento importa sus helpers de `@/lib/analytics` directo.
 */
export function PostHogAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    trackPageView();
  }, [pathname]);

  return null;
}
