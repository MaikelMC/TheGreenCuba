"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Home, Loader2, Mail, Phone } from "lucide-react";
import { CampoContrasena } from "@/components/auth/campo-contrasena";
import { trackClientEvent } from "@/lib/analytics/client";
import { authClient } from "@/lib/auth/client";
import { authErrorCode, messageFor } from "@/lib/auth/error-messages";
import { TERMS_VERSION } from "@/lib/legal";
import {
  readUserPreferences,
  writeUserPreferences,
} from "@/lib/user-preferences-store";
import {
  identifyUser,
  trackUserLoggedIn,
  trackUserRegistered,
} from "@/lib/analytics";
import { EASE } from "@/lib/motion";
import { refreshSession } from "@/lib/session-client";

export type AuthMode = "login" | "register";

/* `lead` es opcional. El acceso no lleva: el titular y los dos campos ya dicen
   todo lo que hay que decir, y una línea de relleno entre los dos solo alarga
   el camino hasta el teclado. El registro sí, porque ahí sí hay algo que
   aclarar de antemano.

   Aquí había un `endpoint` por modo («/api/auth/login», «/api/auth/register»).
   Se fue con esas dos rutas: ahora el envío lo hace el cliente de Better Auth, que
   tiene su propia URL, y el `mode` solo elige qué método se llama. */
const COPY: Record<
  AuthMode,
  { title: string; lead?: string; cta: string }
> = {
  login: {
    /* El «de vuelta» solo tiene sentido para quien ya entró alguna vez: ver
       `TITULO_VUELTA` y `HA_ENTRADO_KEY`. */
    title: "Entra en tu cuenta",
    cta: "Entrar",
  },
  register: {
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
 * Los códigos de abajo son los que Better Auth responde de verdad
 * (comprobados contra su API): `PASSWORD_TOO_SHORT` y `VALIDATION_ERROR` con
 * HTTP 400 al crear la cuenta, `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` con
 * HTTP 422 si el correo ya está, e `INVALID_EMAIL_OR_PASSWORD` con HTTP 401
 * al entrar. La longitud mínima la pone Better Auth (8), y como su mensaje no trae
 * la cifra, el cliente la valida ANTES de enviar para poder decirla.
 */

/* Campo con etiqueta visible, como los del perfil: un marcador que hace de
   etiqueta desaparece en cuanto se escribe y deja el campo sin nombre.
   El `label` envuelve al `input`, así que la asociación es implícita.
   `h-12` son 48 px de alto, por encima de los 44 que pide el pulgar. */
const FIELD =
  "auth-field flex items-center gap-gap-sm rounded-xl border border-ink/10 bg-sand-warm px-gap-sm h-12 transition-colors duration-500 ease-outquint focus-within:border-verde-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-verde-400/20";

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
async function saveRegistration(
  phone: string,
  wantsNews: boolean,
): Promise<boolean> {
  const value = phone.trim();

  /* `phone` solo viaja si hay algo. Mandarlo vacío **borra** el número en el
     servidor —así se distingue «lo vacié» de «no lo toqué»—, y dejarlo en blanco
     al registrarse no es pedir que se borre nada.

     `marketingOptIn` sí viaja siempre, con su `true` o su `false`: aquí la
     ausencia de decisión no existe —la casilla se ve y no está marcada—, y el
     servidor necesita el «no» explícito para saber que ya se preguntó. */
  const body: {
    termsVersion: string;
    phone?: string;
    marketingOptIn: boolean;
  } = {
    termsVersion: TERMS_VERSION,
    marketingOptIn: wantsNews,
  };
  if (value) body.phone = value;

  /* Tres intentos con espera creciente. Antes era uno y su fallo se tragaba: con
     una red mala la cuenta nacía sin teléfono y sin constancia de los términos,
     y nadie se enteraba. Ahora quien llama sabe si quedó guardado. */
  let userId: string | null = null;
  let guardado = false;
  for (let intento = 0; intento < 3 && !guardado; intento++) {
    if (intento > 0) await new Promise((r) => setTimeout(r, 1000 * intento));
    try {
      const response = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) continue;
      const data = (await response.json()) as { user?: { id?: string } | null };
      userId = data.user?.id ?? null;
      guardado = true;
      /* El alta acaba de escribir teléfono y consentimiento: la sesión cacheada
         del módulo se quedaría con lo de antes. */
      refreshSession();
    } catch {
      // Red caída: siguiente intento.
    }
  }

  /* Sin id se escribe en la clave de invitado, que es la que lee quien no
     tiene sesión: el número al menos no se pierde. */
  if (value) {
    writeUserPreferences(
      { ...readUserPreferences(userId), phone: value },
      userId,
    );
  }
  return guardado;
}

/**
 * Marca de «este dispositivo ya entró alguna vez». Se escribe al entrar o
 * registrarse y **no** se borra al cerrar sesión: quien sale y vuelve sigue
 * siendo alguien que vuelve. `la-verde:last-user` (preferencias) cuenta igual,
 * para quien ya había entrado antes de que existiera esta marca.
 */
const HA_ENTRADO_KEY = "la-verde:ha-entrado";
const TITULO_VUELTA = "Bienvenido de vuelta";

function marcarHaEntrado() {
  try {
    window.localStorage.setItem(HA_ENTRADO_KEY, "1");
  } catch {
    // Modo privado: el título se queda en el neutro, sin más.
  }
}

function yaHaEntrado(): boolean {
  try {
    return (
      window.localStorage.getItem(HA_ENTRADO_KEY) === "1" ||
      Boolean(window.localStorage.getItem("la-verde:last-user"))
    );
  } catch {
    return false;
  }
}

type Campo = "email" | "password" | "phone";
const ERROR_ID = "auth-error";

export function AuthCard({
  mode,
  next,
  aviso = null,
  errorInicial = null,
  correoInicial = "",
  googleEnabled = true,
}: {
  mode: AuthMode;
  next: string | null;
  /** Confirmación que trae la URL, p. ej. tras cambiar la contraseña. */
  aviso?: string | null;
  /** Error que trae la URL, p. ej. `?oauthError=google` tras un fallo del
      proveedor. Sin esto, el botón de Google mandaba a `/login?oauthError=google`
      y la pantalla no decía nada: el usuario volvía al formulario sin saber por
      qué. Lo calcula el componente de servidor que monta esto. */
  errorInicial?: string | null;
  correoInicial?: string;
  /** Si el servidor tiene Google OAuth configurado (`GOOGLE_CLIENT_ID` +
      `GOOGLE_CLIENT_SECRET`). Sin credenciales se oculta el botón de Google y el
      aviso solo ofrece crear contraseña: un botón que lleva a `oauthError` no
      ayuda a nadie. Lo calcula el componente de servidor que monta esto. */
  googleEnabled?: boolean;
}) {
  const copy = COPY[mode];

  const [email, setEmail] = useState(correoInicial);
  /* Qué campos tienen la culpa del error. Antes cualquier error marcaba
     correo y contraseña a la vez, y el lector de pantalla anunciaba los dos
     como inválidos por un teléfono vacío. */
  const [camposError, setCamposError] = useState<Campo[]>([]);
  /* La cuenta ya existe pero no se pudo guardar teléfono y términos: el
     siguiente envío solo reintenta eso, porque repetir el alta daría «ese
     correo ya tiene cuenta». */
  const [faltaGuardar, setFaltaGuardar] = useState(false);
  /* Se decide tras montar: el servidor no ve `localStorage`, y pintar el
     neutro en los dos lados evita el desajuste de hidratación. */
  const [vuelve, setVuelve] = useState(false);
  useEffect(() => {
    if (mode === "login") setVuelve(yaHaEntrado());
  }, [mode]);
  const titulo = vuelve ? TITULO_VUELTA : copy.title;
  const [password, setPassword] = useState("");
  /* Solo lo usa el alta. En el acceso el campo ni se pinta. */
  const [phone, setPhone] = useState("");
  /* La casilla de los términos. Tampoco hace falta en el acceso. */
  const [accepted, setAccepted] = useState(false);
  /* «Quiero recibir novedades». Opcional y sin marcar: es una decisión, no un
     peaje para entrar. Solo la usa el alta. */
  const [wantsNews, setWantsNews] = useState(false);
  const [error, setError] = useState<string | null>(errorInicial);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = useCallback(async () => {
    if (loading) return;
    if (mode === "register" && !accepted) {
      setError(
        "Acepta los términos y la política de privacidad para registrarte.",
      );
      return;
    }

    setLoading(true);
    setGoogleLoading(true);
    setError(null);
    try {
      /* Las dos puertas aterrizan en la misma ruta de servidor: es la que
         acepta los términos, intercambia el verificador de sesión y decide el
         destino real (onboarding para una cuenta nueva, `next` o Home para una
         que ya lo completó). Antes, el acceso con Google saltaba directo al
         destino y una cuenta recién creada por ahí se quedaba sin onboarding. */
      const vuelta = new URL("/api/google-auth-complete", window.location.origin);
      if (next) vuelta.searchParams.set("next", next);
      /* Solo el botón de registro pasa por la casilla de términos, así que solo
         él puede decirle a la ruta que hay una aceptación que guardar. */
      if (mode === "register") vuelta.searchParams.set("alta", "1");
      const callbackURL = vuelta.toString();
      const errorCallbackURL = new URL(
        mode === "register"
          ? "/register?oauthError=google"
          : "/login?oauthError=google",
        window.location.origin,
      ).toString();
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL,
        errorCallbackURL,
        ...(mode === "register" ? { newUserCallbackURL: callbackURL } : {}),
      });
      if (result.error) setError(messageFor(result.error, mode));
    } catch (authError) {
      setError(messageFor(authError, mode));
    } finally {
      setLoading(false);
      setGoogleLoading(false);
    }
  }, [accepted, loading, mode, next]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;

      /* Validación en el cliente, antes de salir a la red: cada regla rota dice
         SU nombre. El servidor también valida, pero su mensaje no trae la cifra
         («Password too short»), y decirle «8» aquí no cuesta nada y se ahorra
         un viaje. La casilla de términos la corta antes el `required` nativo
         del propio checkbox, con el mensaje del navegador. */
      /* El autocompletado del móvil deja un espacio al final del correo. Se
         recorta aquí y es este valor el que viaja: antes se validaba recortado
         pero se enviaba tal cual, y el servidor contestaba «correo o contraseña
         incorrectos» con la contraseña buena. */
      const emailTrimmed = email.trim();
      /* Gmail solo se exige al **crear** la cuenta. Al entrar no: las cuentas
         de dominio propio (@laverde.cu, las del arranque de roles) existen y
         se quedaban fuera de su propio acceso. */
      const fallo = (mensaje: string, campos: Campo[]) => {
        setError(mensaje);
        setCamposError(campos);
      };
      if (
        mode === "register" &&
        !/^[^\s@]+@gmail\.com$/i.test(emailTrimmed)
      ) {
        fallo("Para crear la cuenta usa un correo @gmail.com.", ["email"]);
        return;
      }
      if (mode === "register" && password.length < 8) {
        fallo("La contraseña necesita al menos 8 caracteres.", ["password"]);
        return;
      }
      if (mode === "register" && !phone.trim()) {
        fallo("Escribe tu número de teléfono para continuar.", ["phone"]);
        return;
      }

      const irAVerificar = () =>
        window.location.assign(
          `/verify-email?email=${encodeURIComponent(emailTrimmed)}&next=${encodeURIComponent(next ?? "/onboarding")}`,
        );

      setLoading(true);
      setError(null);
      setCamposError([]);

      /* Segunda vuelta tras un guardado fallido: la cuenta ya existe. */
      if (faltaGuardar) {
        if (await saveRegistration(phone, wantsNews)) {
          irAVerificar();
          return;
        }
        fallo(
          "Sigue sin poder guardarse. Revisa tu conexión y vuelve a intentarlo.",
          [],
        );
        setLoading(false);
        return;
      }

      try {
        /* El SDK no lanza cuando las credenciales están mal: devuelve
           `{ data, error }`. Por eso el error se mira como dato y el `catch` de
           abajo queda solo para lo que se rompe antes de salir a la red. */
        const result =
          mode === "login"
            ? await authClient.signIn.email({ email: emailTrimmed, password })
            : await authClient.signUp.email({
                email: emailTrimmed,
                password,
                /* Better Auth pide un nombre y esta pantalla no lo pregunta: el
                   alta son dos campos a propósito. Se usa la parte del correo
                   antes de la arroba, que es lo que hacía el alta anterior y
                   deja siempre algo que enseñar en el menú. */
                name: emailTrimmed.split("@")[0] || emailTrimmed,
              });

        if (result.error) {
          /* El correo existe y la contraseña era la buena: lo que falta es el
             código. El mensaje de siempre diría «correo o contraseña
             incorrectos», que es justo lo contrario de lo que pasa, así que
             esto se corta antes de traducir nada.

             No hay que decirle a la pantalla que mande un código nuevo: lo hace
             siempre que se abre, y aquí el anterior pudo perfectamente caducar. */
          if (
            mode === "login" &&
            authErrorCode(result.error) === "EMAIL_NOT_VERIFIED"
          ) {
            window.location.assign(
              `/verify-email?email=${encodeURIComponent(emailTrimmed)}&next=${encodeURIComponent(next ?? "/home")}`,
            );
            return;
          }
          /* Al entrar, el error de credenciales es de los dos campos a la vez
             (no se dice cuál, a propósito). En el alta casi siempre es el
             correo: ya tiene cuenta o no es válido. */
          fallo(
            messageFor(result.error, mode),
            mode === "login" ? ["email", "password"] : ["email"],
          );
          return;
        }

        /* Identificación y evento de conversión. El id viene con la sesión que
           el SDK acaba de crear; sin él el evento sale igual, solo que anónimo. */
        // Desde aquí, este dispositivo ya «vuelve» la próxima vez.
        marcarHaEntrado();
        const sessionUserId = result.data?.user?.id;
        if (sessionUserId) identifyUser(sessionUserId, { email: emailTrimmed });
        if (mode === "register") {
          trackUserRegistered(Boolean(sessionUserId));
        } else {
          trackUserLoggedIn(Boolean(sessionUserId));
          /* El único sitio donde se puede saber que alguien **entró**: el alta
             de la fila la registra el servidor por su cuenta, pero entrar con
             una cuenta que ya existía no pasa por ninguna ruta nuestra. Solo en
             `login`; el alta la cuenta `getAppUser` en el servidor. */
          trackClientEvent("user_login");
        }

        /* El teléfono y la aceptación se guardan aquí, con la sesión ya emitida,
           y no después del salto: la carga limpia de abajo se lleva por delante
           lo que quede a medias. */
        if (mode === "register" && !(await saveRegistration(phone, wantsNews))) {
          setFaltaGuardar(true);
          fallo(
            "Tu cuenta está creada, pero no pudimos guardar tu teléfono ni la aceptación de los términos. Pulsa «Reintentar» cuando tengas conexión.",
            [],
          );
          return;
        }

        /* El alta no aterriza en la app sino en la pantalla del código. La
           sesión ya está emitida —el servidor la da aunque exija verificar— pero el
           proxy no deja pasar a una ruta privada con el correo sin verificar,
           así que ir a `/onboarding` sería un rebote al mismo sitio. Se lleva
           donde toca, con el destino guardado para después del código.

           El acceso sí entra directo: si el correo estuviera sin verificar, el
           `EMAIL_NOT_VERIFIED` de arriba no habría dejado llegar hasta aquí. */
        if (mode === "register") {
          irAVerificar();
          return;
        }

        /* Carga completa del documento, no `router.replace`. La cookie la acaba
           de escribir el servidor en el navegador y el App Router guarda en caché el
           árbol de la ruta: navegando por cliente se corre el riesgo de pintar
           la versión sin sesión. Una carga limpia no deja lugar a ello. */
        /* Con `URL` y no concatenando: el destino puede traer ya su consulta
           (`/business?negocio=X`), y `${next}?showSessionNotice=1` dejaba un
           segundo `?` que se comía el valor del parámetro anterior. */
        /* Sin `next`, `/entrar` decide en el servidor: quien lleva un negocio
           va a su panel; el resto, al Home. */
        const destino = new URL(next ?? "/entrar", window.location.origin);
        destino.searchParams.set("showSessionNotice", "1");
        window.location.assign(
          `${destino.pathname}${destino.search}${destino.hash}`,
        );
        return;
      } catch (error) {
        fallo(messageFor(error, mode), []);
      } finally {
        setLoading(false);
      }
    },
    [email, faltaGuardar, loading, mode, next, password, phone, wantsNews],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="flex flex-col gap-gap-md"
    >
      {/* El encabezado va fuera de la tarjeta, así que en móvil cae sobre el
          cielo oscuro y en escritorio sobre la arena. De ahí los dos juegos de
          color: el mismo texto, dos fondos. */}
      {/* Centrado: el logo de móvil ya va centrado encima, y el título
          alineado a la izquierda debajo quedaba descolgado. */}
      <header className="flex flex-col items-center gap-gap-xs text-center">
        <h1 className="font-lv-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-white text-balance lg:text-ink">
          {titulo}
        </h1>
        {copy.lead && (
          <p className="text-small text-white/70 text-pretty lg:text-ink-soft/75">
            {copy.lead}
          </p>
        )}
      </header>

      <form
        onSubmit={handleSubmit}
        className="auth-form rounded-2xl bg-white shadow-soft p-gap-lg flex flex-col gap-gap-md"
      >
        {/* Confirmación que llega por la URL (contraseña cambiada). Mismo
            estilo que el aviso de reenvío de la verificación. */}
        {aviso && !error && (
          <p
            role="status"
            className="rounded-xl border border-verde-400/30 bg-verde-400/10 px-gap-sm py-gap-xs text-meta text-verde-800"
          >
            {aviso}
          </p>
        )}

        <label className="flex flex-col gap-gap-xs">
          <span className={LABEL}>Correo</span>
          <span className={FIELD}>
            <Mail
              size={16}
              strokeWidth={1.8}
              className="text-ink-soft/75 shrink-0"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              /* `username` en los dos: es lo que los gestores de contraseñas
                 (Chrome, Llavero de iOS) emparejan con la contraseña para
                 guardarla y ofrecerla después. Con `email` a veces no la
                 asociaban a la cuenta. */
              autoComplete="username"
              inputMode="email"
              required
              readOnly={faltaGuardar}
              aria-invalid={camposError.includes("email") || undefined}
              aria-describedby={
                camposError.includes("email") ? ERROR_ID : undefined
              }
              className="flex-1 min-w-0 bg-transparent text-small text-ink outline-none placeholder:text-ink-soft/75"
              placeholder={
                mode === "register" ? "tucorreo@gmail.com" : "tucorreo@ejemplo.com"
              }
            />
          </span>
        </label>

        <CampoContrasena
          etiqueta="Contraseña"
          value={password}
          onChange={setPassword}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          invalido={camposError.includes("password")}
          descritoPor={ERROR_ID}
        />

        {/* Solo en el alta, y obligatorio: el negocio necesita un teléfono de
            contacto para que La Verde pueda localizarlo. */}
        {mode === "register" && (
          <label className="flex flex-col gap-gap-xs">
            <span className={LABEL}>Teléfono</span>
            <span className={FIELD}>
              <Phone
                size={16}
                strokeWidth={1.8}
                className="text-ink-soft/75 shrink-0"
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                required
                aria-invalid={camposError.includes("phone") || undefined}
                aria-describedby={
                  camposError.includes("phone") ? ERROR_ID : undefined
                }
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

        {/* «Quiero recibir novedades». Opcional y sin marcar, y sin `required`:
            es la diferencia entre una decisión y un peaje. Al no marcarla no se
            pierde nada —quien entra con Google ni la ve, y se le pregunta una vez
            ya dentro—. Va después de los términos porque el orden es de más a
            menos obligatorio. */}
        {mode === "register" && (
          <label className="flex items-start gap-gap-sm text-meta leading-relaxed text-ink-soft">
            <input
              type="checkbox"
              checked={wantsNews}
              onChange={(e) => setWantsNews(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-verde-500"
            />
            <span>Quiero recibir novedades</span>
          </label>
        )}

        {/* El error va pegado a los campos, no en un aviso flotante: es donde
            está la mirada cuando el envío falla. `role="alert"` para que un
            lector de pantalla lo anuncie sin mover el foco. */}
        <AnimatePresence>
          {error && (
            <motion.p
              id={ERROR_ID}
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
          className="mt-gap-2xs inline-flex items-center justify-center gap-gap-xs w-full h-12 rounded-full bg-verde-400 text-verde-950 font-lv-display text-small font-semibold shadow-primary-halo hover:bg-verde-300 transition duration-500 ease-outquint active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
        >
          {loading ? (
            <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
          ) : (
            <ArrowRight size={16} strokeWidth={1.8} />
          )}
          {loading ? "Comprobando…" : faltaGuardar ? "Reintentar" : copy.cta}
        </button>

        {/* Aviso de las cuentas de Google, visible **siempre** en el acceso y no
            solo cuando el envío falla: quien se registró con Google no tiene
            contraseña, así que «correo o contraseña incorrectos» es lo único que
            puede recibir y no le dice qué hacer. Con esto delante, el botón de
            Google está a un renglón de distancia y el enlace resuelve el otro
            camino —crear una contraseña desde el correo—. Va aquí, pegado al
            botón de entrar y justo antes del separador que abre la vía de
            Google. */}
        {mode === "login" && (
          <p className="rounded-xl border border-ink/10 bg-sand-warm px-gap-sm py-gap-xs text-meta leading-relaxed text-ink-soft/80">
            ¿Te registraste con Google?{" "}
            {googleEnabled ? "Entra con Google o crea" : "Crea"} una contraseña
            desde{" "}
            <Link
              href="/forgot-password"
              className="font-semibold text-verde-600 underline underline-offset-2 transition-colors duration-500 ease-outquint hover:text-verde-700"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        )}

        {/* Vía de Google: solo si el servidor tiene credenciales. Sin ellas, el
            separador y el botón desaparecen enteros —un botón que redirige a
            `oauthError=google` sería una trampa—. Reaparece solo al configurar
            `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. */}
        {googleEnabled && (
        <>
        <div
          className="flex items-center gap-gap-sm text-meta text-ink-soft/75"
          aria-hidden="true"
        >
          <span className="h-px flex-1 bg-ink/10" />
          <span>o continúa con</span>
          <span className="h-px flex-1 bg-ink/10" />
        </div>

        <button
          type="button"
          onClick={() => void handleGoogleSignIn()}
          disabled={loading}
          aria-busy={googleLoading}
          className="auth-google-button inline-flex h-12 w-full items-center justify-center gap-gap-sm rounded-full border border-ink/15 bg-white font-lv-display text-small font-semibold text-ink transition-colors hover:bg-sand disabled:pointer-events-none disabled:opacity-60"
        >
          {googleLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 48 48"
              className="size-5"
              focusable="false"
            >
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6c4.51-4.17 7.07-10.14 7.07-17.65z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59a14.4 14.4 0 0 1-.76-4.59c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.86.93 7.5 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
            </svg>
          )}
          {googleLoading
            ? "Conectando con Google…"
            : mode === "login"
              ? "Iniciar sesión con Google"
              : "Registrarse con Google"}
        </button>
        </>
        )}
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
              /* El destino viaja de un formulario al otro: quien abre una
                 invitación cae en el alta, y si resulta que ya tenía cuenta el
                 acceso tiene que devolverlo a la misma invitación. */
              href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
              className="font-semibold text-verde-300 transition-colors duration-500 ease-outquint hover:text-verde-200 lg:text-verde-600 lg:hover:text-verde-700"
            >
              Crear una
            </Link>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta?{" "}
            <Link
              href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
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
