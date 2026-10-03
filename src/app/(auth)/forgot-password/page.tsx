"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { siteConfig } from "@/config/site";
import { EASE } from "@/lib/motion";

/**
 * Dónde aterriza el enlace del correo.
 *
 * El origen configurado, ni más ni menos. Neon lo valida contra su lista de
 * dominios de confianza (`isTrustedOrigin`, en `originCheck`) y **rechaza con
 * 403 todo lo que no esté ahí**, así que esta URL tiene que ser una de las de
 * esa lista o el envío no sale.
 *
 * No vale inventarse el origen del navegador ni caer al dominio de producción
 * en desarrollo: en desarrollo el despliegue aún no tiene `/reset-password`, así
 * que el correo llevaría a un 404. En el despliegue `NEXT_PUBLIC_APP_URL` ya
 * vale el dominio de producción, y ese origen está dado de alta en Neon.
 *
 * La barra final se quita por si alguien la dejó puesta.
 */
const RESET_REDIRECT = `${siteConfig.url.replace(/\/+$/, "")}/reset-password`;

/* Mismas clases que los campos del alta (`auth-card.tsx`). Son dos constantes
   de texto; sacarlas a un módulo compartido sería más ceremonia que copiarlas. */
const FIELD =
  "auth-field flex items-center gap-gap-sm rounded-2xl border border-ink/10 bg-sand-warm px-gap-sm h-12 transition-colors duration-500 ease-outquint focus-within:border-verde-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-verde-400/20";
const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";

/**
 * Pedir el enlace de recuperación.
 *
 * `requestPasswordReset` es el nombre real del método en el cliente instalado
 *  —`@neondatabase/auth@0.5.0-beta` monta Better Auth 1.6.23—, no el
 * `forgetPassword` de versiones viejas: se comprobó contra la definición de la
 * ruta `/request-password-reset` dentro de `node_modules`.
 *
 * El `redirectTo` es donde aterriza quien pulsa el enlace del correo, con el
 * token en la consulta —ver `RESET_REDIRECT`—. Neon decide el buzón y el envío;
 * aquí solo se pide.
 *
 * La respuesta es la misma exista o no la cuenta —decir «ese correo no está»
 * confirmaría qué correos hay dados de alta—, así que el aviso de enviado no
 * promete que el enlace llegue, solo que el intento salió.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;

      const value = email.trim();
      if (!value) {
        setError("Escribe tu correo.");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await authClient.requestPasswordReset({
          email: value,
          redirectTo: RESET_REDIRECT,
        });
        /* El SDK no lanza: devuelve `{ error }`. Un 4xx aquí significa que la
           petición no salió —falta el correo, el servicio no responde—, no que
           la cuenta no exista. */
        if (result.error) {
          setError("No se pudo enviar el enlace. Inténtalo en un momento.");
          return;
        }
        setSent(true);
      } catch {
        setError("No se pudo enviar el enlace. Inténtalo en un momento.");
      } finally {
        setLoading(false);
      }
    },
    [email, loading],
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
          Recuperar acceso
        </span>
        <h1 className="font-lv-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-white lg:text-ink">
          {sent ? "Revisa tu correo" : "¿Olvidaste tu contraseña?"}
        </h1>
        <p className="text-small text-white/70 text-pretty lg:text-ink-soft/75">
          {sent
            ? "Si ese correo tiene cuenta, te llegó un enlace para crear una contraseña nueva. Caduca pronto, así que úsalo cuando lo veas."
            : "Escribe el correo de tu cuenta y te mandamos un enlace para crear una contraseña nueva."}
        </p>
      </header>

      <div className="rounded-4xl border border-ink/5 bg-white shadow-soft p-gap-lg flex flex-col gap-gap-md">
        {sent ? (
          <Link
            href="/login"
            className="inline-flex h-12 w-full items-center justify-center gap-gap-sm rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98]"
          >
            Volver al acceso
          </Link>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-gap-md">
            <label className="flex flex-col gap-gap-xs">
              <span className={LABEL}>Correo</span>
              <span className={FIELD}>
                <Mail size={16} strokeWidth={1.8} className="text-ink-soft/75 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  aria-label="Correo"
                  aria-invalid={error ? true : undefined}
                  className="flex-1 min-w-0 bg-transparent text-small text-ink outline-none placeholder:text-ink-soft/75"
                  placeholder="usuario@laverde.cu"
                />
              </span>
            </label>

            {error && (
              <p
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
              className="inline-flex h-12 w-full items-center justify-center gap-gap-xs rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo transition-all duration-500 ease-outquint hover:bg-verde-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
              ) : (
                <ArrowRight size={16} strokeWidth={1.8} />
              )}
              {loading ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-meta text-white/70 lg:text-ink-soft/75">
        ¿Te acordaste?{" "}
        <Link
          href="/login"
          className="font-semibold text-verde-300 transition-colors duration-500 ease-outquint hover:text-verde-200 lg:text-verde-600 lg:hover:text-verde-700"
        >
          Entrar
        </Link>
      </p>
    </motion.div>
  );
}
