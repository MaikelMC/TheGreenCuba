"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { CampoContrasena } from "@/components/auth/campo-contrasena";

const ERROR_ID = "reset-error";

const INVALID_LINK =
  "El enlace no es válido o ha caducado. Pide uno nuevo desde «¿Olvidaste tu contraseña?».";

/**
 * Crear la contraseña nueva a partir del token del correo.
 *
 * El token llega en la consulta de la URL. Hay **dos** formas de que falte, y las
 * dos se ven aquí:
 *
 * - La página llega sin `token` ni `error`, que es lo que pasa al abrir la ruta a
 *   mano.
 * - Better Auth redirige con `?error=INVALID_TOKEN` cuando el enlace ya no sirve
 *   —caducado, ya usado o inventado—. Ese `error` lo lee la página de servidor y
 *   entra por la prop `linkError`.
 *
 * `resetPassword` también responde `INVALID_TOKEN` si el token se agota entre la
 * carga y el envío, así que el mismo texto cubre las dos ventanas. Y hace algo
 * que no se ve aquí: si la cuenta venía de Google y no tenía contraseña, **se la
 * crea** —lo hace Better Auth al no encontrar cuenta `credential`—, que es justo
 * el camino que destraba a ese usuario.
 */
export function ResetPasswordForm({
  token,
  linkError,
  email,
}: {
  token: string;
  linkError: boolean;
  /** De qué cuenta es, para el campo de usuario oculto. Puede venir vacío. */
  email: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;

      /* La longitud la valida Better Auth igual —y su mensaje no trae la cifra—, así que
         se comprueba antes para poder decirla. La confirmación es lo que evita
         dejar a alguien fuera por una errata en el campo único. */
      if (password.length < 8) {
        setError("La contraseña necesita al menos 8 caracteres.");
        return;
      }
      if (password !== confirm) {
        setError("Las dos contraseñas no coinciden.");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await authClient.resetPassword({
          newPassword: password,
          token,
        });
        if (result.error) {
          /* Los dos códigos que la ruta devuelve de verdad, leídos de
             `node_modules` y no supuestos: `INVALID_TOKEN` (token agotado o
             inventado) y `PASSWORD_TOO_SHORT`. */
          const code = String(
            (result.error as { code?: unknown }).code ?? "",
          ).toUpperCase();
          if (code === "PASSWORD_TOO_SHORT") {
            setError("La contraseña necesita al menos 8 caracteres.");
          } else if (code === "INVALID_TOKEN") {
            setError(INVALID_LINK);
          } else {
            setError("No se pudo cambiar la contraseña. Inténtalo de nuevo.");
          }
          return;
        }
        /* Carga completa, como el resto de saltos tras un cambio de sesión: el
           App Router cachea el árbol de la ruta y una navegación de cliente
           podría pintar el `/login` de antes. */
        /* `cambiada=1` pinta la confirmación en el acceso; antes se llegaba a
           un `/login` en blanco sin saber si había funcionado. */
        const destino = new URLSearchParams({ cambiada: "1" });
        if (email) destino.set("email", email);
        window.location.assign(`/login?${destino.toString()}`);
      } catch {
        setError("No se pudo cambiar la contraseña. Inténtalo de nuevo.");
      } finally {
        setLoading(false);
      }
    },
    [confirm, email, loading, password, token],
  );

  const deadLink = linkError || !token;

  return (
    /* Entrada en CSS, como en `forgot-password`: sin `motion` para un fundido. */
    <div className="flex flex-col gap-gap-md animate-[fade-up_250ms_ease-out] motion-reduce:animate-none">
      <header className="flex flex-col items-center gap-gap-xs text-center">
        <h1 className="font-lv-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-white lg:text-ink">
          Elige una contraseña
        </h1>
        <p className="text-small text-white/70 text-pretty lg:text-ink-soft/75">
          {deadLink
            ? INVALID_LINK
            : "La usará tu cuenta para entrar con correo y contraseña a partir de ahora."}
        </p>
      </header>

      <div className="rounded-2xl bg-white shadow-soft p-gap-lg flex flex-col gap-gap-md">
        {deadLink ? (
          <Link
            href="/forgot-password"
            className="inline-flex h-12 w-full items-center justify-center gap-gap-sm rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
          >
            Pedir otro enlace
          </Link>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-gap-md">
            {/* Campo de usuario oculto: es lo que dice a Chrome y al Llavero
                de iOS qué cuenta guardada actualizar con la contraseña nueva.
                `hidden` y no `sr-only`: no debe leerse ni recibir foco. */}
            {email && (
              <input
                type="email"
                name="username"
                autoComplete="username"
                value={email}
                readOnly
                hidden
              />
            )}

            <CampoContrasena
              etiqueta="Contraseña nueva"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              invalido={Boolean(error)}
              descritoPor={ERROR_ID}
            />

            <CampoContrasena
              etiqueta="Repítela"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              invalido={Boolean(error)}
              descritoPor={ERROR_ID}
            />

            {error && (
              <p
                id={ERROR_ID}
                role="alert"
                className="rounded-xl border border-destructive/20 bg-destructive/5 px-gap-sm py-gap-xs text-meta text-destructive"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="inline-flex h-12 w-full items-center justify-center gap-gap-xs rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo transition duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
              ) : (
                <ArrowRight size={16} strokeWidth={1.8} />
              )}
              {loading ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-meta text-white/70 lg:text-ink-soft/75">
        <Link
          href="/login"
          className="font-semibold text-verde-300 transition-colors duration-500 ease-outquint hover:text-verde-200 lg:text-verde-600 lg:hover:text-verde-700"
        >
          Volver al acceso
        </Link>
      </p>
    </div>
  );
}
