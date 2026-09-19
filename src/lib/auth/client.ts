"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/**
 * Neon Managed Auth, del lado del navegador.
 *
 * Va sin argumentos a propósito. En Next.js el cliente lee su propia URL de
 * `NEXT_PUBLIC_NEON_AUTH_URL`; pasarle una a mano es la firma del SDK de React
 * para SPAs (`createAuthClient(url)`) y además duplicaría el origen, que es
 * justo lo que hay que tener en un solo sitio: `next.config.ts` lo lee de la
 * misma variable para abrir el `connect-src` del CSP.
 *
 * Lo usan tres sitios: el formulario de `AuthCard`, el botón de salir de
 * `src/lib/logout.ts` y el menú de usuario, que saca el estado con
 * `authClient.useSession()`.
 */
export const authClient = createAuthClient();
