"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/**
 * Cliente de autenticación de Neon para componentes de cliente.
 * En Next.js lee `NEXT_PUBLIC_NEON_AUTH_URL` automáticamente.
 */
export const authClient = createAuthClient();
