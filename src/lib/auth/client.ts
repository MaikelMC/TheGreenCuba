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
 * Lo usan dos sitios, y el segundo con `import()`: el formulario de `AuthCard`
 * —que *es* la pantalla de `/login`, así que ahí cargarlo de entrada está bien—
 * y el botón de salir de `src/lib/logout.ts`, que lo carga solo al pulsarlo.
 * Este paquete son unos 105 KB comprimidos —Better Auth entero— y, como
 * `logout` lo importaba de forma estática y medio sitio importa `logout`,
 * entraba en el paquete inicial de todas las páginas con header.
 *
 * Aquí decía que el menú de usuario sacaba el estado con
 * `authClient.useSession()`. Ya no: `UserMenu` pregunta a `/api/me`, que es lo
 * único que sabe el **rol**, y el rol es la mitad de lo que ese menú enseña.
 */
export const authClient = createAuthClient();
