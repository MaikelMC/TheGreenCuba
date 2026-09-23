"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/logout";

/**
 * Cuánto puede quedarse alguien sin tocar nada antes de que se le cierre la
 * sesión.
 *
 * Eran tres minutos, y en un sitio de descubrir lugares son muy pocos: leer una
 * ficha entera, mirar el menú o comparar dos negocios se hace sin mover el ratón
 * ni la pantalla, y a los tres minutos la lectura se interrumpía sola. Treinta
 * minutos es el rato que se le da por defecto a una sesión inactiva, y sigue
 * siendo corto para lo que esta protección busca —una sesión olvidada abierta en
 * un equipo compartido—.
 *
 * El contador solo se reinicia con gestos de verdad (`mousemove`, `scroll`,
 * `touchstart`…), no con el simple paso del tiempo, así que una pestaña de fondo
 * también caduca. Es lo que se quiere.
 */
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

export function InactivityGuard() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login" || pathname === "/register") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    function scheduleLogout() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!active) return;
        active = false;
        void logout();
      }, INACTIVITY_LIMIT_MS);
    }

    fetch("/api/me")
      .then((response) => response.json())
      .then((data: { authenticated?: boolean }) => {
        if (!active || !data.authenticated) return;
        scheduleLogout();
        for (const eventName of ACTIVITY_EVENTS) {
          window.addEventListener(eventName, scheduleLogout, { passive: true });
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, scheduleLogout);
      }
    };
  }, [pathname]);

  return null;
}
