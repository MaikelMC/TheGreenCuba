"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Home, Loader2, Lock, Mail, Phone } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { messageFor } from "@/lib/auth/error-messages";
import { TERMS_VERSION } from "@/lib/legal";
import { readUserPreferences, writeUserPreferences } from "@/lib/user-preferences-store";
import { identifyUser, trackUserLoggedIn, trackUserRegistered } from "@/lib/analytics";
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
 *
 * Los códigos de abajo son los que el backend de Neon Auth responde de verdad
 * (comprobados contra su API): `PASSWORD_TOO_SHORT` y `VALIDATION_ERROR` con
 * HTTP 400 al crear la cuenta, `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` con
 * HTTP 422 si el correo ya está, e `INVALID_EMAIL_OR_PASSWORD` con HTTP 401
 * al entrar. La longitud mínima la pone Neon (8), y como su mensaje no trae
 * la cifra, el cliente la valida ANTES de enviar para poder decirla.
 */


/* Campo con etiqueta visible, como los del perfil: un marcador que hace de
   etiqueta desaparece en cuanto se escribe y deja el campo sin nombre.
   El `label` envuelve al `input`, así que la asociación es implícita.
   `h-12` son 48 px de alto, por encima de los 44 que pide el pulgar. */
const FIELD =
  "auth-field flex items-center gap-gap-sm rounded-2xl border border-ink/10 bg-sand-warm px-gap-sm h-12 transition-colors duration-500 ease-outquint focus-within:border-verde-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-verde-400/20";

const LABEL = "font-lv-display text-meta font-semibold text-ink-soft/75";

/**
 * Lo que el alta recoge y Better Auth no conoce: el teléfono y la aceptación de
 * los términos.
 *
 * Su alta son correo y contraseña, así que lo demás va por nuestra tabla. El
 * `POST` de `/api/me` es el mismo que usa el perfil para guardar, y de paso crea
 * la fila del usuario recién dado de alta y devuelve su id. Una sola llamada
 * para las tres cosas.
 *
 * **Se llama siempre, aunque no haya teléfono.** Antes salía antes de tiempo si
 * el campo estaba vacío, y entonces daba igual —no había nada que guardar—. Con
 * la aceptación dentro del mismo `POST`, ese `return` habría dejado sin
 * constancia a todo el que no escribiera su número.
 *
 * La copia en `localStorage` no es un extra: el onboarding arma las preferencias
 * a partir de ahí, y el perfil las lee antes de que llegue la respuesta de la
 * red. Se escribe bajo la clave del usuario —por eso hace falta el id— y no bajo
 * la de invitado: con la suya, cualquier lectura posterior lo encuentra, tenga
 * id o no. Si la red falla, cae en la de invitado y el número al menos no se
 * pierde.
 */
async function saveRegistration(phone: string): Promise<void> {
  const value = phone.trim();

  /* `phone` solo viaja si hay algo. Mandarlo vacío **borra** el número en el
     servidor —así se distingue «lo vacié» de «no lo toqué»—, y dejarlo en blanco
     al registrarse no es pedir que se borre nada. */
  const body: { termsVersion: string; phone?: string } = { termsVersion: TERMS_VERSION };
  if (value) body.phone = value;

  let userId: string | null = null;
  try {
    const response = await fetch("/api/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as { user?: { id?: string } | null };
    userId = data.user?.id ?? null;
  } catch {
    // Sin id se escribe en la clave de invitado, que es la que lee quien no tiene sesión.
  }

  if (value) {
    writeUserPreferences({ ...readUserPreferences(userId), phone: value }, userId);
  }
}

export function AuthCard({ mode, next }: { mode: AuthMode; next: string | null }) {
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  /* Solo lo usa el alta. En el acceso el campo ni se pinta. */
  const [phone, setPhone] = useState("");
  /* La casilla de los términos. Tampoco hace falta en el acceso. */
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;

      /* Validación en el cliente, antes de salir a la red: cada regla rota dice
         SU nombre. El servidor también valida, pero su mensaje no trae la cifra
         («Password too short»), y decirle «8» aquí no cuesta nada y se ahorra
         un viaje. La casilla de términos la corta antes el `required` nativo
         del propio checkbox, con el mensaje del navegador. */
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
      if (!emailOk) {
        setError("Escribe un correo válido, por ejemplo usuario@laverde.cu");
        return;
      }
      if (mode === "register" && password.length < 8) {
        setError("La contraseña necesita al menos 8 caracteres.");
        return;
      }

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

        /* Identificación y evento de conversión. El id viene con la sesión que
           el SDK acaba de crear; sin él el evento sale igual, solo que anónimo. */
        const sessionUserId = result.data?.user?.id;
        if (sessionUserId) identifyUser(sessionUserId, { email });
        if (mode === "register") {
          trackUserRegistered(Boolean(sessionUserId));
        } else {
          trackUserLoggedIn(Boolean(sessionUserId));
        }

        /* El teléfono y la aceptación se guardan aquí, con la sesión ya emitida,
           y no después del salto: la carga limpia de abajo se lleva por delante
           lo que quede a medias. */
        if (mode === "register") await saveRegistration(phone);

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
    [email, loading, mode, next, password, phone],
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
        className="auth-form rounded-4xl border border-ink/5 bg-white shadow-soft p-gap-lg flex flex-col gap-gap-md"
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
              aria-invalid={error ? true : undefined}
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

        {/* Solo en el alta. Es opcional a propósito: el sitio funciona sin el
            número, y un campo obligatorio de más en el registro cuesta altas.
            Quien lo deja vacío se queda como estaba hasta ahora. */}
        {mode === "register" && (
          <label className="flex flex-col gap-gap-xs">
            <span className={LABEL}>
              Teléfono <span className="font-normal">(opcional)</span>
            </span>
            <span className={FIELD}>
              <Phone size={16} strokeWidth={1.8} className="text-ink-soft/75 shrink-0" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                aria-label="Teléfono"
                className="flex-1 min-w-0 bg-transparent text-small text-ink outline-none placeholder:text-ink-soft/75"
                placeholder="+53 5 123 4567"
              />
            </span>
          </label>
        )}

        {/* La casilla de los términos. Obligatoria, y con el `required` nativo
            sobre el propio `checkbox`: está dentro del `<form>`, así que el
            navegador corta el envío antes de que salga, lo anuncia en su idioma
            y no hace falta ni una línea de JavaScript ni un estado más que
            mantener.

            El enlace abre en pestaña nueva a propósito. Quien está a medio
            registro no puede perder lo escrito por ir a leer el contrato, y
            volver atrás no siempre devuelve el formulario como estaba. */}
        {mode === "register" && (
          <label className="auth-terms-label flex items-start gap-gap-sm text-meta leading-relaxed text-ink-soft">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              required
              className="auth-terms-checkbox mt-0.5 size-4 shrink-0 accent-verde-500"
            />
            <span>
              He leído y acepto los{" "}
              <Link
                href="/terminos"
                target="_blank"
                rel="noopener noreferrer"
                className="auth-terms-link font-semibold text-verde-600 underline underline-offset-2 transition-colors duration-500 ease-outquint hover:text-verde-700"
              >
                términos y la política de privacidad
              </Link>
              , incluido el tratamiento de mis datos tal como se describe ahí.
            </span>
          </label>
        )}

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
          className="mt-gap-2xs inline-flex items-center justify-center gap-gap-xs w-full h-12 rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo hover:bg-verde-300 transition-all duration-500 ease-outquint active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
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
        className="auth-home-link inline-flex items-center justify-center gap-gap-xs h-11 rounded-full border border-white/30 text-white font-lv-display text-small font-semibold transition-colors duration-500 ease-outquint hover:bg-white/10 lg:border-ink/10 lg:text-ink-soft lg:hover:bg-white"
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
