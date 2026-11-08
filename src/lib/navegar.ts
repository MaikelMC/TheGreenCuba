"use client";

import { sinRed } from "@/lib/offline/estado-red";

/**
 * Navega a una URL.
 *
 * Con red usa `push` (SPA navigation). Sin red usa `window.location.assign`,
 * que provoca una navegación completa y deja que el service worker sirva la
 * copia cacheada o la página offline correcta.
 *
 * `navigator.onLine` puede mentir; se combina con el estado que mantiene
 * `estado-red.ts` a partir de eventos reales de la cola.
 */
export function navegar(url: string, push: (url: string) => void): void {
  if (typeof window === "undefined") return;
  if (sinRed() || !navigator.onLine) {
    window.location.assign(url);
  } else {
    push(url);
  }
}
