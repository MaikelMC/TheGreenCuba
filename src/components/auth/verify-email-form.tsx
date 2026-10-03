"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { authErrorCode } from "@/lib/auth/error-messages";
import { EASE } from "@/lib/motion";

/** Los mismos que impone el servidor: `email-otp` deja 3 envíos cada 60 s. */
const COOLDOWN_SECONDS = 60;
const OTP_LENGTH = 6;

/**
 * Qué decir cuando el código no vale.
 *
 * Los tres códigos salen de `email-otp/error-codes.mjs` del paquete instalado,
 * no de la documentación: `INVALID_OTP` (el número no es), `OTP_EXPIRED` (se
 * pasó el tiempo) y `TOO_MANY_ATTEMPTS` (tres fallos y el servidor borra el
 * código, así que insistir con el mismo no sirve de nada y hay que pedir otro).
 *
 * El «caducó» y el «demasiados intentos» dicen lo que hay que hacer —pedir otro
 * código— porque son los dos casos en los que el botón de reenviar es la salida.
 */
function messageForCode(error: unknown): string {
  switch (authErrorCode(error)) {
    case "OTP_EXPIRED":
      return "El código caducó. Pide uno nuevo.";
    case "TOO_MANY_ATTEMPTS":
      return "Demasiados intentos con ese código. Pide uno nuevo.";
    case "INVALID_OTP":
      return "Ese código no es correcto. Revísalo.";
    default:
      return "No se pudo comprobar el código. Inténtalo en un momento.";
  }
}

/**
 * El código de verificación del correo.
 *
 * El código se pide nada más abrir, siempre. Hacía falta: el envío que Neon hace
 * al crear la cuenta **no llega** —probado con un alta real, el primer código
 * había que pedirlo a mano—, así que esperar a que alguien pulse «reenviar» para
 * recibir el primero era pedir un clic por un correo que nunca salió. De paso
 * cubre el otro camino, el del acceso, donde el código anterior pudo caducar.
 *
 * El reenvío manual lleva cuenta atrás porque el servidor corta a los tres
 * envíos por minuto: un botón que se puede pulsar y siempre falla es peor que
 * uno que dice cuánto falta.
 */
export function VerifyEmailForm({
  email,
  next,
}: {
  email: string;
  next: string;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  /* El envío del arranque tiene que salir **una** vez. Sin esta bandera, el
     doble montaje de los efectos en desarrollo gastaría dos de los tres envíos
     del minuto antes de que nadie escriba nada. */
  const resent = useRef(false);

  const resend = useCallback(async () => {
    setError(null);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      if (result.error) {
        setError(
          authErrorCode(result.error) === "TOO_MANY_REQUESTS"
            ? "Demasiados envíos seguidos. Espera un minuto."
            : "No se pudo enviar el código. Inténtalo en un momento.",
        );
        return;
      }
      setNotice("Te enviamos un código nuevo.");
      setCooldown(COOLDOWN_SECONDS);
    } catch {
      setError("No se pudo enviar el código. Inténtalo en un momento.");
    }
  }, [email]);

  useEffect(() => {
    if (resent.current) return;
    resent.current = true;
    void resend();
  }, [resend]);

  /* La cuenta atrás. Depende de si está corriendo y no del número, para que el
     intervalo se cree una vez por cuenta y no una por segundo. */
  const counting = cooldown > 0;
  useEffect(() => {
    if (!counting) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [counting]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;

      const value = code.trim();
      if (value.length !== OTP_LENGTH) {
        setError(`El código son ${OTP_LENGTH} dígitos.`);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await authClient.emailOtp.verifyEmail({
          email,
          otp: value,
        });
        if (result.error) {
          setError(messageForCode(result.error));
          return;
        }
        /* Carga completa del documento, como en el acceso: el servidor acaba de
           reescribir la caché de la cookie de sesión con `emailVerified: true`,
           y el App Router no tiene por qué enterarse de eso. */
        window.location.assign(next);
      } catch (authError) {
        setError(messageForCode(authError));
      } finally {
        setLoading(false);
      }
    },
    [code, email, loading, next],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: EASE }}
      className="flex flex-col gap-gap-md"
    >
      <header className="flex flex-col gap-gap-xs">
        <span className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-200 lg:text-verde-600">
          Un paso más
        </span>
        <h1 className="font-lv-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-white lg:text-ink">
          Mira tu correo
        </h1>
        <p className="text-small text-white/70 text-pretty lg:text-ink-soft/75">
          Te mandamos un código de {OTP_LENGTH} dígitos a{" "}
          <span className="font-semibold text-white lg:text-ink">{email}</span>.
          Escríbelo aquí y quedas dentro.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-4xl border border-ink/5 bg-white shadow-soft p-gap-lg flex flex-col gap-gap-md"
      >
        <label className="flex flex-col gap-gap-xs">
          <span className="font-lv-display text-meta font-semibold text-ink-soft/75">
            Código
          </span>
          <input
            value={code}
            /* Solo dígitos y como mucho seis: el teclado numérico del móvil no
               impide pegar letras, y el servidor rechazaría el envío entero. */
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            aria-label="Código de verificación"
            aria-invalid={error ? true : undefined}
            className="h-14 w-full rounded-2xl border border-ink/10 bg-sand-warm text-center font-lv-display text-[24px] font-semibold tabular-nums text-ink outline-none transition-colors duration-500 ease-outquint placeholder:tracking-[0.3em] placeholder:text-ink-soft/30 focus:border-verde-400 focus:bg-white focus:ring-2 focus:ring-verde-400/20"
            placeholder="······"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/20 bg-destructive/5 px-gap-sm py-gap-xs text-meta text-destructive"
          >
            {error}
          </p>
        )}

        {/* El aviso del reenvío solo se pinta si no hay error: los dos ocupan el
            mismo sitio y el error es lo que hay que leer. */}
        {notice && !error && (
          <p className="rounded-xl border border-verde-400/30 bg-verde-400/10 px-gap-sm py-gap-xs text-meta text-verde-800">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="inline-flex h-12 w-full items-center justify-center gap-gap-xs rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <ArrowRight size={16} strokeWidth={1.8} />
          )}
          {loading ? "Comprobando..." : "Verificar"}
        </button>

        <button
          type="button"
          onClick={() => void resend()}
          disabled={counting || loading}
          className="self-center text-meta font-semibold text-verde-600 underline underline-offset-2 transition-colors duration-500 ease-outquint hover:text-verde-700 disabled:cursor-default disabled:no-underline disabled:opacity-60 cursor-pointer"
        >
          {counting ? `Reenviar en ${cooldown} s` : "Reenviar código"}
        </button>
      </form>

      <p className="text-center text-meta text-white/70 lg:text-ink-soft/75">
        ¿No es tu correo?{" "}
        <Link
          href="/login"
          className="font-semibold text-verde-300 transition-colors duration-500 ease-outquint hover:text-verde-200 lg:text-verde-600 lg:hover:text-verde-700"
        >
          Vuelve al acceso
        </Link>
      </p>
    </motion.div>
  );
}
