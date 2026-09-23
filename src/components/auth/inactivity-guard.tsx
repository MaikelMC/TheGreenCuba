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

  /* Un booleano y no el `pathname` en las dependencias del efecto, y no es un
     detalle: con la ruta entera, cada navegación —`/home` → `/mapa` → una
     ficha— desmontaba y volvía a montar el efecto, que quiere decir volver a
     preguntar `/api/me` y registrar cinco escuchadores de ventana otra vez. Una
     consulta a la base por cada clic, para recibir siempre la misma respuesta: si
     este componente está pintado y no te ha echado, ya hay sesión.
     Lo único que el efecto necesita saber es si está en una pantalla de acceso. */
  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (isAuthPage) return;

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
  }, [isAuthPage]);

  return null;
}
