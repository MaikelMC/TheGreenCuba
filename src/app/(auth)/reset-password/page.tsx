import { ResetPasswordForm } from "@/components/auth/reset-password-form";

/**
 * Aterrizaje del enlace del correo.
 *
 * Es un componente de **servidor** porque el token viene en la consulta y así se
 * lee sin `useSearchParams`, que en Next 16 obliga a envolver la página en un
 * `Suspense` para poder prerenderizarla. Aquí solo se pasa hacia abajo.
 *
 * Better Auth redirige a esta ruta de dos maneras: con `?token=…` si el enlace sirve, o
 * con `?error=INVALID_TOKEN` si ya no —caducado o usado—. Las dos llegan al
 * mismo formulario; la segunda entra por `linkError`.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const linkError = Boolean(params.error);
  /* Lo añade `forgot-password` al pedir el enlace. Los enlaces pedidos antes
     de este cambio no lo traen, y el formulario funciona igual sin él. */
  const email = typeof params.email === "string" ? params.email : "";

  return <ResetPasswordForm token={token} linkError={linkError} email={email} />;
}
