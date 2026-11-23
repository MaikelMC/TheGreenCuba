import { AuthCard } from "@/components/auth/auth-card";
import { safeNext } from "@/lib/session";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; oauthError?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      mode="register"
      next={safeNext(params.next)}
      errorInicial={
        params.oauthError === "google"
          ? "No se pudo continuar con Google. Inténtalo de nuevo o crea tu cuenta con correo."
          : null
      }
      googleEnabled={Boolean(
        process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
      )}
    />
  );
}
