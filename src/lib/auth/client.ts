"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

/**
 * Cliente de autenticación para componentes de cliente.
 *
 * Sin `baseURL`: Better Auth usa el origen actual, y todas sus llamadas van a
 * `/api/auth/*` en este mismo dominio. El plugin de OTP se declara también aquí
 * para que `authClient.emailOtp` exista y esté tipado; los endpoints los pone
 * el servidor.
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});
