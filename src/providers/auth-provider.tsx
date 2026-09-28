"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import "@neondatabase/auth-ui/css";

/**
 * Proveedor de Neon Auth UI.
 * Habilita: Email OTP, Social Login (Google), Organization support.
 *
 * IMPORTANTE: Para que Google OAuth funcione, configura en Neon Console:
 * Project → Branch → Auth → Configuration → Social Providers → Google
 * Agrega tus credenciales OAuth de Google Cloud Console (Client ID + Secret).
 * Sin esto, usa las "Shared Keys" de Neon (solo testing).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => router.refresh()}
      emailOTP
      social={{ providers: ["google"] }}
      redirectTo="/home"
      Link={Link}
      organization={{}}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
