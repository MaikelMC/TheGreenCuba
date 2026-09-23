"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Home, Loader2, Lock, Mail } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { EASE } from "@/lib/motion";

export type AuthMode = "login" | "register";

/* `lead` es opcional. El acceso no lleva: el titular y los dos campos ya dicen
   todo lo que hay que decir, y una línea de relleno entre los dos solo alarga
   el camino hasta el teclado. El registro sí, porque ahí sí hay algo que
   aclarar de antemano.

   Aquí había un `endpoint` por modo («/api/auth/login», «/api/auth/register»).
   Se fue con esas dos rutas: ahora el envío lo hace el cliente de Neon, que
   tiene su propia URL, y el `mode` solo elige qué método se llama. */
const COPY: Record<AuthMode, { eyebrow: string; title: string; lead?: string; cta: string }> = {
  login: {
    eyebrow: "Acceso",
    title: "Bienvenido de vuelta",
    cta: "Entrar",
  },
  register: {
    eyebrow: "Cuenta nueva",
    title: "Crea tu perfil",
    lead: "Treinta segundos. Te preguntamos lo justo para acertar con lo que te enseñamos.",
    cta: "Empezar",
  },
};

/**
 * Texto del error que se enseña.
 *
 * El SDK devuelve `{ data, error }` y no lanza, así que el error de credenciales
 * llega como dato, no como excepción. Su mensaje viene en inglés y con su
 * vocabulario, así que no se enseña tal cual.
 *
 * Para credenciales malas se devuelve **uno solo** para los dos casos: decir
 * «ese correo no existe» por separado confirma qué correos están dados de alta.
 * El mínimo de caracteres de la contraseña lo pone la configuración de Neon, no
 * esta pantalla, de ahí que el mensaje no repita una cifra que podría no ser la
 * suya.
 */
function messageFor(error: unknown, mode: AuthMode): string {
  const value = error && typeof error === "object"
    ? (error as Record<string, unknown>)
    : {};
  const nested = value.error && typeof value.error === "object"
    ? (value.error as Record<string, unknown>)
    : {};
  const errorCode = String(value.code ?? nested.code ?? "").toLowerCase();
  const errorMessage = String(value.message ?? nested.message ?? error ?? "");
  const errorText = `${errorCode} ${errorMessage} ${collectErrorText(error)}`.toLowerCase();
  const status = Number(value.status ?? nested.status ?? value.statusCode ?? nested.statusCode);
  const accountExists =
    errorCode === "user_already_exists" ||
    errorCode === "email_exists" ||
    errorText.includes("already exists") ||
    errorText.includes("already registered") ||
    errorText.includes("user_exists") ||
    errorText.includes("email_exists");

  if (accountExists) {
    return "Correo ya registrado. Entra en su lugar.";
  }
  if (status === 401) return "Correo o contraseña incorrectos.";
  if (status === 400 || status === 422 || errorCode === "validation_error") {
    return "Revisa los datos: el correo o la contraseña no son válidos.";
  }
  if (status >= 500) {
    return "La autenticación no responde. Inténtalo en un momento.";
  }
  return mode === "login"
    ? "No se pudo entrar. Inténtalo de nuevo."
    : "No se pudo crear la cuenta. Inténtalo de nuevo.";
}

function safeSerialize(value: unknown): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

function collectErrorText(value: unknown, depth = 0): string {
  if (depth > 3 || value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);

  const record = value as Record<string, unknown>;
  const keys = ["code", "message", "name", "statusText", "cause", "data", "details", "response"];
  return keys
    .map((key) => collectErrorText(record[key], depth + 1))
    .filter(Boolean)
    .join(" ");
}

/* Campo con etiqueta visible, como los del perfil: un marcador que hace de
   etiqueta desaparece en cuanto se escribe y deja el campo sin nombre.
   El `label` envuelve al `input`, así que la asociación es implícita.
   `h-12` son 48 px de alto, por encima de los 44 que pide el pulgar. */
const FIELD =
  "flex items-center gap-gap-sm rounded-2xl border border-ink/10 bg-sand-warm px-gap-sm h-12 transition-colors duration-500 ease-outquint focus-within:border-verde-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-verde-400/20";

const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";

export function AuthCard({ mode, next }: { mode: AuthMode; next: string | null }) {
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;

      setLoading(true);
      setError(null);
      try {
        /* El SDK no lanza cuando las credenciales están mal: devuelve
           `{ data, error }`. Por eso el error se mira como dato y el `catch` de
           abajo queda solo para lo que se rompe antes de salir a la red. */
        const result =
          mode === "login"
            ? await authClient.signIn.email({ email, password })
            : await authClient.signUp.email({
                email,
                password,
                /* Better Auth pide un nombre y esta pantalla no lo pregunta: el
                   alta son dos campos a propósito. Se usa la parte del correo
                   antes de la arroba, que es lo que hacía el alta anterior y
                   deja siempre algo que enseñar en el menú. */
                name: email.split("@")[0] || email,
              });

        if (result.error) {
          setError(messageFor(result.error, mode));
          return;
        }

        /* Carga completa del documento, no `router.replace`. La cookie la acaba
           de escribir Neon en el navegador y el App Router guarda en caché el
           árbol de la ruta: navegando por cliente se corre el riesgo de pintar
           la versión sin sesión. Una carga limpia no deja lugar a ello. */
        const destination = mode === "register" ? next ?? "/onboarding" : next ?? "/home";
        window.location.assign(destination);
        return;
      } catch (error) {
        setError(messageFor(error, mode));
      } finally {
        setLoading(false);
      }
    },
    [email, loading, mode, next, password],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: EASE }}
      className="flex flex-col gap-gap-md"
    >
      {/* El encabezado va fuera de la tarjeta, así que en móvil cae sobre el
          cielo oscuro y en escritorio sobre la arena. De ahí los dos juegos de
          color: el mismo texto, dos fondos. */}
      <header className="flex flex-col gap-gap-xs">
        <span className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-200 lg:text-verde-600">
          {copy.eyebrow}
        </span>
        <h1 className="font-lv-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-white lg:text-ink">
          {copy.title}
        </h1>
        {copy.lead && (
          <p className="text-small text-white/70 text-pretty lg:text-ink-soft/75">
            {copy.lead}
          </p>
        )}
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-4xl border border-ink/5 bg-white shadow-soft p-gap-lg flex flex-col gap-gap-md"
      >
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
              className="flex-1 min-w-0 bg-transparent text-small text-ink outline-none placeholder:text-ink-soft/75"
              placeholder="usuario@laverde.cu"
            />
          </span>
        </label>

        <label className="flex flex-col gap-gap-xs">
          <span className={LABEL}>Contraseña</span>
          <span className={FIELD}>
            <Lock size={16} strokeWidth={1.8} className="text-ink-soft/75 shrink-0" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              aria-label="Contraseña"
              aria-invalid={error ? true : undefined}
              className="flex-1 min-w-0 bg-transparent text-small text-ink outline-none placeholder:text-ink-soft/75"
              placeholder="••••••••"
            />
          </span>
        </label>

        {/* El error va pegado a los campos, no en un aviso flotante: es donde
            está la mirada cuando el envío falla. `role="alert"` para que un
            lector de pantalla lo anuncie sin mover el foco. */}
        <AnimatePresence>
          {error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="text-meta text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-gap-sm py-gap-xs"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="mt-gap-2xs inline-flex items-center justify-center gap-gap-xs w-full h-12 rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-[0_18px_40px_-12px_rgba(53,175,109,0.6)] hover:bg-verde-300 transition-all duration-500 ease-outquint active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
        >
          {loading ? (
            <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <ArrowRight size={16} strokeWidth={1.8} />
          )}
          {loading ? "Comprobando..." : copy.cta}
        </button>
      </form>

      <Link
        href="/"
        className="inline-flex items-center justify-center gap-gap-xs h-11 rounded-full border border-white/30 text-white font-lv-display text-small font-semibold transition-colors duration-500 ease-outquint hover:bg-white/10 lg:border-ink/10 lg:text-ink-soft lg:hover:bg-white"
      >
        <Home size={16} strokeWidth={1.8} />
        Volver a la página principal
      </Link>

      <p className="text-center text-meta text-white/70 lg:text-ink-soft/75">
        {mode === "login" ? (
          <>
            ¿Sin cuenta?{" "}
            <Link
              href="/register"
              className="font-semibold text-verde-300 transition-colors duration-500 ease-outquint hover:text-verde-200 lg:text-verde-600 lg:hover:text-verde-700"
            >
              Crear una
            </Link>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="font-semibold text-verde-300 transition-colors duration-500 ease-outquint hover:text-verde-200 lg:text-verde-600 lg:hover:text-verde-700"
            >
              Entrar
            </Link>
          </>
        )}
      </p>
    </motion.div>
  );
}
