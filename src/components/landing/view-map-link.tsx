"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import {
  getCurrentPosition,
  getLastKnownPosition,
} from "@/lib/map/geolocation";

/* Tope para no dejar el botón esperando si el permiso no se contesta. Pasado
   ese tiempo se entra igual y el home termina de resolver la posición. */
const FIX_WAIT_MS = 2500;

/**
 * «Ver el mapa» pide la ubicación en el mismo toque que navega.
 *
 * El permiso se pide dentro del gesto —varios navegadores solo lo enseñan así—
 * y la posición queda en caché antes de entrar, de modo que el mapa arranca en
 * la zona del visitante en vez de en La Habana. Si el permiso se niega o tarda,
 * se navega igual: el mapa y su botón «Mi ubicación» siguen ahí.
 */
export function ViewMapLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    /* Ctrl/cmd/shift o botón central: abrir en otra pestaña se deja al navegador. */
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();

    if (!getLastKnownPosition()) {
      await Promise.race([
        getCurrentPosition({ timeout: 8000 }).catch(() => null),
        new Promise((resolve) => setTimeout(resolve, FIX_WAIT_MS)),
      ]);
    }

    router.push("/home?ubicacion=1");
  }

  return (
    <Link href="/home?ubicacion=1" className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
