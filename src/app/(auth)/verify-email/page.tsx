import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { safeNext } from "@/lib/session";

/**
 * Pantalla del código de verificación.
 *
 * Componente de servidor por el mismo motivo que `/reset-password`: el correo
 * llega en la consulta y así se lee sin `useSearchParams`, que en Next 16 obliga
 * a envolver la página en un `Suspense` para poder prerenderizarla.
 *
 * Esta ruta **no** está en `PROTECTED_PREFIXES`, y a propósito: quien llega aquí
 * no puede pasar por ninguna ruta privada —es justo el paso que le falta—, así
 * que pedirle sesión para verla sería un bucle.
 *
 * Quien llega trae el correo en la consulta y el formulario pide el código solo,
 * al montarse: el envío que Neon hace al crear la cuenta no llega, así que
 * esperar a que alguien pulse «reenviar» era pedir un clic por un correo que
 * nunca salió. Está contado en el formulario.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email.trim() : "";

  /* Sin correo no hay nada que verificar y no hay forma de adivinarlo. Se vuelve
     al acceso, que es donde el correo se escribe. */
  if (!email) redirect("/login");

  return (
    <VerifyEmailForm email={email} next={safeNext(params.next) ?? "/home"} />
  );
}
